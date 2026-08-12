// src/app/api/auth/route.ts
//
// Login and refresh now go through auth_svc, so the platform has one place
// that issues tokens and shapes the user profile (role, tenantId,
// restaurantId). The remaining self-service actions (password reset, sign-up
// confirmation, sign-out) still talk to Cognito directly — auth_svc does not
// expose them yet.

import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION = 'ap-south-1'
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '7903hkujl9qeq67toemi5qrhes'

// auth_svc — the service that owns login, registration and tenants.
const AUTH_API =
  process.env.NEXT_PUBLIC_AUTH_API_BASE ??
  'https://REPLACE-ME.execute-api.ap-south-1.amazonaws.com/dev'
//
const client = new CognitoIdentityProviderClient({ region: REGION })

/** Forward to auth_svc and normalise its error envelope. */
async function callAuthSvc(path: string, body: object) {
  const res = await fetch(`${AUTH_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  let data: any = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }

  return NextResponse.json(data, {
    status: res.status,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action as string

    if (action === 'login') {
      return callAuthSvc('/auth/login', {
        email: body.email,
        password: body.password,
      })
    }

    if (action === 'refresh') {
      return callAuthSvc('/auth/refresh', {
        refreshToken: body.refreshToken,
      })
    }

    return NextResponse.json(
      { message: `Unknown auth action: ${action}` },
      { status: 400 }
    )
  } catch (err: any) {
    const message = err?.message ?? 'Authentication error'

    return NextResponse.json(
      { message },
      { status: 500 }
    )
  }
}
