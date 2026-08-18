// src/app/api/auth-svc/[...path]/route.ts
//
// Server-side proxy to auth_svc for tenant and user management.
// The browser never calls the API Gateway directly; this route forwards the
// caller's Authorization header so auth_svc can apply its own role checks.

import { NextRequest, NextResponse } from 'next/server'

const AUTH_API =
  process.env.NEXT_PUBLIC_AUTH_API_BASE

async function forward(req: NextRequest, path: string[]) {
  const upstream = `${AUTH_API}/${path.join('/')}${req.nextUrl.search}`

  // API Gateway drops a bare token — always send the Bearer scheme.
  let auth = req.headers.get('authorization') ?? ''
  if (auth && !auth.startsWith('Bearer ')) auth = `Bearer ${auth}`

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    cache: 'no-store',
  }

  if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    init.body = await req.text()
  }

  const res  = await fetch(upstream, init)
  const text = await res.text()

  try {
    return NextResponse.json(text ? JSON.parse(text) : {}, { status: res.status })
  } catch {
    return new NextResponse(text, { status: res.status })
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
