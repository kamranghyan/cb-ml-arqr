// src/app/api/menu/[...path]/route.ts  —  TENANT CONSOLE

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
  let auth = req.headers.get('authorization') ?? '';
  if (!auth) return NO_TENANT;
  if (!auth.startsWith('Bearer ')) {
    auth = `Bearer ${auth}`;
  }

  const claims = parseJwt(auth.slice(7));
  const groups = (claims['cognito:groups'] as string[]) ?? [];
  const ownTenant = (claims['custom:tenant_id'] as string) ?? '';

  let tenantId = ownTenant;
  if (!tenantId) {
    if (!groups.includes('menulay_admin')) {
      return NO_TENANT;
    }
    tenantId = req.headers.get('x-tenant-id') ?? '';
    if (!tenantId) {
      return ADMIN_NEEDS_TENANT;
    }
  }

  const pathString = path.join('/');
  const upstream = `${API_BASE}/menus/${pathString}${req.nextUrl.search}`;

  const ct = req.headers.get('content-type') ?? '';
  const headers: Record<string, string> = {
    'X-Tenant-Id': tenantId,
    Authorization: auth,
  };

  console.log('========== MENU PROXY ==========');
  console.log('UPSTREAM:', upstream);
  console.log('METHOD:', req.method);
  console.log('CONTENT TYPE:', ct);
  console.log('TENANT:', tenantId);
  console.log('================================');

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    if (ct.includes('multipart')) {
      // ✅ FIX: Properly handle FormData
      const formData = await req.formData();

      // ✅ Create new FormData
      const forwardFormData = new FormData();

      // ✅ Log all fields for debugging
      console.log('📤 FORM DATA FIELDS:');
      let imageCount = 0;

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`   ${key}: File(${value.name}, ${value.size} bytes)`);
          
          // ✅ Count images
          if (key === 'images') {
            imageCount++;
          }
          
          // ✅ Forward file with proper filename
          forwardFormData.append(key, value, value.name);
        } else {
          console.log(`   ${key}: ${value}`);
          
          // ✅ Forward text fields
          forwardFormData.append(key, value);
        }
      }

      console.log(`📸 Total images found: ${imageCount}`);

      // ✅ If there are images but 'slides' JSON has empty imageKey, 
      // we need to ensure backend creates slides from images
      const slidesField = formData.get('slides');
      if (slidesField && typeof slidesField === 'string') {
        try {
          const slides = JSON.parse(slidesField);
          console.log('📋 Slides JSON:', slides);
          
          // ✅ If images exist but slides have empty imageKey,
          // backend should fill them. But we can also reconstruct slides.
          if (imageCount > 0 && slides.length > 0) {
            // ✅ Ensure slides array matches number of images
            const reconstructedSlides = slides.map((slide: any, index: number) => ({
              position: slide.position || index + 1,
              imageKey: slide.imageKey || '', // Backend will fill
            }));
            
            // ✅ Replace slides with reconstructed version
            forwardFormData.set('slides', JSON.stringify(reconstructedSlides));
            console.log('🔄 Reconstructed slides:', JSON.stringify(reconstructedSlides));
          }
        } catch (e) {
          console.error('❌ Failed to parse slides JSON:', e);
        }
      }

      // ✅ Remove Content-Type header - fetch will set it with proper boundary
      delete headers['Content-Type'];
      init.body = forwardFormData;

    } else {
      headers['Content-Type'] = ct || 'application/json';
      init.body = await req.text();
    }
  }

  // ... rest of the code
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path);
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path);
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return forward(req, (await ctx.params).path);
}