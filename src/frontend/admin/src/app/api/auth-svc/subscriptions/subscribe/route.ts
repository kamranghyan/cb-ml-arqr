import { NextRequest, NextResponse } from 'next/server';

const SUBS_SVC_BASE =
    process.env.NEXT_PUBLIC_SUBS_SVC_API_BASE;

export async function POST(request: NextRequest) {
    try {
        if (!SUBS_SVC_BASE) {
            console.error(
                '❌ Missing NEXT_PUBLIC_SUBS_SVC_API_BASE'
            );

            return NextResponse.json(
                {
                    error:
                        'Server configuration error: Subscription Service Base URL missing',
                },
                { status: 500 }
            );
        }

        // ─────────────────────────────────────────────
        // Auth
        // ─────────────────────────────────────────────

        const authHeader =
            request.headers.get('authorization') ?? '';

        const tenantId =
            request.headers.get('x-tenant-id') ?? '';

        // ─────────────────────────────────────────────
        // Read frontend body
        // ─────────────────────────────────────────────

        const body = await request
            .json()
            .catch(() => null);

        console.log(
            '📥 SUBSCRIBE PROXY RECEIVED BODY:',
            body
        );

        // Backend schema expects:
        // {
        //     "plan_id": "quarterly"
        // }

        const planId = body?.plan_id;

        if (!planId) {
            console.error(
                '❌ plan_id missing from frontend body:',
                body
            );

            return NextResponse.json(
                {
                    error: 'plan_id is required',
                    receivedBody: body,
                },
                { status: 400 }
            );
        }

        // ─────────────────────────────────────────────
        // Backend URL
        // ─────────────────────────────────────────────

        const cleanBase =
            SUBS_SVC_BASE.replace(/\/+$/, '');

        const upstreamUrl =
            `${cleanBase}/api/v1/subscriptions/subscribe`;

        console.log(
            '📤 SUBSCRIBE PROXY → BACKEND'
        );

        console.log(
            'URL:',
            upstreamUrl
        );

        console.log(
            'Tenant ID:',
            tenantId
        );

        console.log(
            'Plan ID:',
            planId
        );

        // IMPORTANT:
        // FastAPI SubscriptionCreate expects plan_id.
        const upstreamBody = {
            plan_id: planId,
        };

        console.log(
            '📦 BACKEND PAYLOAD:',
            upstreamBody
        );

        // ─────────────────────────────────────────────
        // Call backend
        // ─────────────────────────────────────────────

        const res = await fetch(upstreamUrl, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',

                ...(authHeader
                    ? {
                        Authorization: authHeader,
                    }
                    : {}),

                ...(tenantId
                    ? {
                        'X-Tenant-Id': tenantId,
                    }
                    : {}),
            },

            body: JSON.stringify(upstreamBody),

            cache: 'no-store',
        });

        // ─────────────────────────────────────────────
        // Read response
        // ─────────────────────────────────────────────

        const rawText = await res.text();

        let data: any = null;

        try {
            data = rawText
                ? JSON.parse(rawText)
                : null;
        } catch {
            data = {
                message: rawText,
            };
        }

        console.log(
            '📡 BACKEND RESPONSE STATUS:',
            res.status
        );

        console.log(
            '📡 BACKEND RESPONSE:',
            data
        );

        // ─────────────────────────────────────────────
        // Backend error
        // ─────────────────────────────────────────────

        if (!res.ok) {
            return NextResponse.json(
                {
                    error:
                        data?.error ??
                        data?.detail ??
                        data?.message ??
                        'Failed to subscribe',

                    backendStatus: res.status,

                    backendResponse: data,
                },
                {
                    status: res.status,
                }
            );
        }

        // ─────────────────────────────────────────────
        // Success
        // ─────────────────────────────────────────────

        return NextResponse.json(
            data,
            {
                status: res.status || 200,
            }
        );
    } catch (error: any) {
        console.error(
            '❌ Subscribe proxy crash:',
            error
        );

        return NextResponse.json(
            {
                error:
                    error?.message ||
                    'Internal server error',
            },
            {
                status: 500,
            }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,

        headers: {
            'Access-Control-Allow-Origin': '*',

            'Access-Control-Allow-Methods':
                'POST, OPTIONS',

            'Access-Control-Allow-Headers':
                'Content-Type, Authorization, X-Tenant-Id',
        },
    });
}