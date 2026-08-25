// src/app/api/menu/[...path]/route.ts — TENANT CONSOLE

import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE

/** Read (not verify) the token payload — the backend verifies it properly. */
function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

const NO_TENANT = NextResponse.json(
  { error: 'Your session does not identify a company. Please sign in again.' },
  { status: 401 },
)

const ADMIN_NEEDS_TENANT = NextResponse.json(
  { error: 'Choose a company first — an administrator is not tied to one.' },
  { status: 400 },
)

async function forward(req: NextRequest, path: string[]) {
  let auth = req.headers.get('authorization') ?? ''
  if (!auth) return NO_TENANT
  if (!auth.startsWith('Bearer ')) {
    auth = `Bearer ${auth}`
  }

  const claims = parseJwt(auth.slice(7))
  const groups = (claims['cognito:groups'] as string[]) ?? []
  // ✅ FIX: should be string, not string[]
  const ownTenant = (claims['custom:tenant_id'] as string) ?? ''

  let tenantId = ownTenant
  if (!tenantId) {
    if (!groups.includes('menulay_admin')) {
      return NO_TENANT
    }
    tenantId = req.headers.get('x-tenant-id') ?? ''
    if (!tenantId) {
      return ADMIN_NEEDS_TENANT
    }
  }

  const pathString = path.join('/')
  const upstream = `${API_BASE}/menus/${pathString}${req.nextUrl.search}`

  const ct = req.headers.get('content-type') ?? ''
  const headers: Record<string, string> = {
    'X-Tenant-Id': tenantId,
    Authorization: auth,
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    if (ct.includes('multipart')) {
      const formData = await req.formData()
      const forwardFormData = new FormData()

      let imageCount = 0
      const imageFiles: File[] = []

      // ✅ First pass: collect all data
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          if (key === 'images') {
            imageCount++
            imageFiles.push(value)
            // ✅ Append each image with a unique identifier
            forwardFormData.append('images', value, value.name)
          } else if (key === 'file') {
            // Main image
            forwardFormData.append('file', value, value.name)
          } else if (key === 'arFile') {
            // AR model file
            forwardFormData.append('arFile', value, value.name)
          } else {
            forwardFormData.append(key, value, value.name)
          }
        } else {
          forwardFormData.append(key, value)
        }
      }

      // ✅ Log what we received
      console.log(`📸 Received ${imageCount} image(s) for slides`)

      // ✅ Reconstruct slides with proper image keys
      const slidesField = formData.get('slides')
      if (slidesField && typeof slidesField === 'string') {
        try {
          const slides = JSON.parse(slidesField)
          if (imageCount > 0 && slides.length > 0) {
            // ✅ Map images to slides based on position
            const reconstructedSlides = slides.map((slide: any, index: number) => ({
              position: slide.position || index + 1,
              // ✅ Use the position to determine which image belongs to which slide
              imageKey: slide.imageKey || `slide-${index + 1}`,
              // ✅ Store original filename for debugging
              _originalName: imageFiles[index]?.name || ''
            }))
            forwardFormData.set('slides', JSON.stringify(reconstructedSlides))
            console.log('✅ Reconstructed slides:', JSON.stringify(reconstructedSlides))
          } else if (imageCount > 0 && slides.length === 0) {
            // ✅ If there are images but no slides array, create one
            const autoSlides = imageFiles.map((file, index) => ({
              position: index + 1,
              imageKey: `slide-${index + 1}`,
              _originalName: file.name
            }))
            forwardFormData.set('slides', JSON.stringify(autoSlides))
            console.log('✅ Auto-created slides:', JSON.stringify(autoSlides))
          }
        } catch (e) {
          console.error('❌ Failed to parse slides JSON:', e)
          // ✅ Keep original slides if parsing fails
          forwardFormData.set('slides', slidesField)
        }
      } else if (imageCount > 0) {
        // ✅ If no slides field but images exist, create slides
        const autoSlides = imageFiles.map((file, index) => ({
          position: index + 1,
          imageKey: `slide-${index + 1}`,
          _originalName: file.name
        }))
        forwardFormData.set('slides', JSON.stringify(autoSlides))
        console.log('✅ Auto-created slides from images:', JSON.stringify(autoSlides))
      }

      // ✅ Log final form data for debugging
      console.log('📦 Forwarding FormData with keys:', 
        Array.from(forwardFormData.keys()).join(', ')
      )
      
      // ✅ Log all file names being sent
      for (const [key, value] of forwardFormData.entries()) {
        if (value instanceof File) {
          console.log(`  📎 ${key}: ${value.name} (${value.size} bytes)`)
        } else {
          console.log(`  📝 ${key}: ${value}`)
        }
      }

      // Delete Content-Type so fetch generates the proper boundary header
      delete headers['Content-Type']
      init.body = forwardFormData
    } else {
      headers['Content-Type'] = ct || 'application/json'
      const bodyText = await req.text()
      console.log('📤 Forwarding JSON body:', bodyText.substring(0, 200))
      init.body = bodyText
    }
  }

  try {
    console.log(`🚀 Forwarding to upstream: ${upstream}`)
    const upstreamRes = await fetch(upstream, init)

    // Handle 204 No Content responses cleanly
    if (upstreamRes.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const resContentType = upstreamRes.headers.get('content-type') ?? ''
    const responseData = await upstreamRes.arrayBuffer()

    // ✅ Log response for debugging
    const responseString = Buffer.from(responseData).toString('utf8')
    console.log(`📤 Response from upstream (${upstreamRes.status}):`, responseString.substring(0, 500))

    // ✅ Try to parse and check if slides are in the response
    try {
      const parsedResponse = JSON.parse(responseString)
      if (parsedResponse.slides) {
        console.log(`📸 Response contains ${parsedResponse.slides.length} slides:`, parsedResponse.slides)
      } else if (parsedResponse.items) {
        parsedResponse.items.forEach((item: any, index: number) => {
          if (item.slides) {
            console.log(`📸 Item ${index + 1} has ${item.slides.length} slides:`, item.slides)
          }
        })
      }
    } catch (e) {
      // Not JSON or no slides
    }

    return new NextResponse(responseData, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: {
        'content-type': resContentType,
      },
    })
  } catch (err: any) {
    console.error('❌ Proxy Upstream Fetch Error:', err)
    return NextResponse.json(
      { error: 'Failed to communicate with upstream service.' },
      { status: 502 }
    )
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path)
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path)
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path)
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path)
}