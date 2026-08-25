// src/app/api/auth-svc/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server'

const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_BASE

async function forward(req: NextRequest, path: string[]) {
  if (!AUTH_API) {
    console.error('❌ NEXT_PUBLIC_AUTH_API_BASE is not defined in environment variables!')
    return NextResponse.json(
      { error: 'Server configuration error: Base API URL missing' },
      { status: 500 }
    )
  }

  // Clean trailing slashes from AUTH_API
  const baseUrl = AUTH_API.replace(/\/+$/, '')
  const pathString = path.join('/')
  const upstream = `${baseUrl}/${pathString}${req.nextUrl.search}`

  let auth = req.headers.get('authorization') ?? ''
  if (auth && !auth.startsWith('Bearer ')) {
    auth = `Bearer ${auth}`
  }

  const ct = req.headers.get('content-type') ?? 'application/json'

  const headers: Record<string, string> = {
    'Content-Type': ct,
    ...(auth ? { Authorization: auth } : {}),
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  }

  if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    try {
      init.body = await req.text()
    } catch (err) {
      console.error('❌ Failed to read request body:', err)
    }
  }

  try {
    console.log(`========== AUTH PROXY ==========`)
    console.log(`METHOD: ${req.method}`)
    console.log(`UPSTREAM: ${upstream}`)
    console.log(`================================`)

    const res = await fetch(upstream, init)
    const text = await res.text()

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    try {
      return NextResponse.json(text ? JSON.parse(text) : {}, { status: res.status })
    } catch {
      return new NextResponse(text, { status: res.status })
    }
  } catch (error: any) {
    console.error('❌ Proxy upstream fetch crashed:', error?.message || error)
    return NextResponse.json(
      { error: 'Failed to communicate with Auth Service upstream', details: error?.message },
      { status: 502 }
    )
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}