import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE =
  process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE;

export async function GET(
  request: NextRequest,
  ctx: {
    params: Promise<{
      tenantId?: string;
      path?: string[];
    }>;
  }
) {
  try {
    if (!SUBS_SVC_BASE) {
      console.error(
        '❌ NEXT_PUBLIC_SUBS_SVC_API_BASE is missing'
      );

      return NextResponse.json(
        {
          error:
            'Server configuration error: Base API URL missing',
        },
        { status: 500 }
      );
    }

    const resolvedParams = await ctx.params;

    let tenantId = resolvedParams.tenantId;

    if (!tenantId && resolvedParams.path?.length) {
      tenantId =
        resolvedParams.path[
          resolvedParams.path.length - 1
        ];
    }

    // Prefer the X-Tenant-Id header if available.
    // This prevents accidentally forwarding SUB_xxx as tenant ID.
    const headerTenantId =
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Tenant-Id') ||
      '';

    if (headerTenantId) {
      tenantId = headerTenantId;
    }

    const authHeader =
      request.headers.get('authorization') ?? '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Prevent accidentally treating subscription IDs as tenant IDs.
    if (tenantId.startsWith('SUB_')) {
      console.error(
        '❌ Invalid tenant ID received. Subscription ID was provided:',
        tenantId
      );

      return NextResponse.json(
        {
          error:
            'Invalid tenant ID. Please provide the actual tenant ID, not subscription ID.',
        },
        { status: 400 }
      );
    }

    const cleanBase = SUBS_SVC_BASE.replace(/\/+$/, '');

    const upstreamUrl =
      `${cleanBase}/api/v1/subscriptions/status/${encodeURIComponent(
        tenantId
      )}`;

    console.log('--------------------------------------------------');
    console.log('📡 [DEBUG PROXY] Calling Upstream:');
    console.log('  URL:', upstreamUrl);
    console.log('  Tenant ID:', tenantId);
    console.log(
      '  Auth Header Length:',
      authHeader.length
    );
    console.log('--------------------------------------------------');

    const res = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'X-Tenant-Id': tenantId,
      },
      cache: 'no-store',
    });

    const rawText = await res.text();

    console.log(
      `📡 Upstream Response Status: ${res.status}`
    );
    console.log(
      '📡 Upstream Raw Body:',
      rawText
    );

    if (res.status === 404) {
      return NextResponse.json(null, {
        status: 200,
      });
    }

    let parsedData: any = {};

    try {
      parsedData = rawText
        ? JSON.parse(rawText)
        : {};
    } catch {
      parsedData = {
        raw: rawText,
      };
    }

    return NextResponse.json(parsedData, {
      status: res.status,
    });
  } catch (error: any) {
    console.error(
      '❌ Proxy Level Error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message || 'Proxy Error',
      },
      { status: 500 }
    );
  }
}