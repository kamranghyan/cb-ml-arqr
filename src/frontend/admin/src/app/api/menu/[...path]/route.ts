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
  console.log('PATH:', pathString);
  console.log('================================');

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    if (ct.includes('multipart')) {
      // ✅ FIX: Use formData() instead of arrayBuffer()
      const formData = await req.formData();
      
      // ✅ Create a new FormData to forward
      const forwardFormData = new FormData();
      
      // Copy all fields
      for (const [key, value] of formData.entries()) {
        forwardFormData.append(key, value);
      }
      
      // ✅ Don't set Content-Type header - let fetch set it with boundary
      // Remove Content-Type from headers so fetch adds it with correct boundary
      delete headers['Content-Type'];
      
      init.body = forwardFormData;
      
      console.log('📤 Forwarding FormData with fields:');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`   ${key}: File(${value.name}, ${value.size} bytes)`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      }
    } else {
      headers['Content-Type'] = ct || 'application/json';
      init.body = await req.text();
    }
  }

  const res = await fetch(upstream, init);
  const text = await res.text();

  console.log('========== MENU UPSTREAM RESPONSE ==========');
  console.log('STATUS:', res.status);
  console.log('BODY:', text);
  console.log('============================================');

  try {
    return NextResponse.json(
      text ? JSON.parse(text) : {},
      { status: res.status }
    );
  } catch {
    return new NextResponse(text, { status: res.status });
  }
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
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
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