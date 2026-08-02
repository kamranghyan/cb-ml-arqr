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

const REGION    = 'ap-south-1'
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '7903hkujl9qeq67toemi5qrhes'

// auth_svc — the service that owns login, registration and tenants.
const AUTH_API =
  process.env.NEXT_PUBLIC_AUTH_API_BASE ??
  'https://REPLACE-ME.execute-api.ap-south-1.amazonaws.com/dev'

const client = new CognitoIdentityProviderClient({ region: REGION })

/** Forward to auth_svc and normalise its error envelope. */
async function callAuthSvc(path: string, body: object) {
  const res  = await fetch(`${AUTH_API}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { message: text } }

  if (!res.ok) {
    const message =
      data?.error?.message ?? data?.message ?? data?.detail ?? 'Authentication failed'
    return NextResponse.json({ message }, { status: res.status })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const action = body.action as string

    // ── auth_svc ────────────────────────────────────────────────────

    if (action === 'login') {
      // auth_svc returns { idToken, accessToken, refreshToken, expiresIn, user }
      return callAuthSvc('/auth/login', {
        email:    body.email,
        password: body.password,
      })
    }

    if (action === 'refresh') {
      return callAuthSvc('/auth/refresh', { refreshToken: body.refreshToken })
    }

    // ── Still direct to Cognito ─────────────────────────────────────

    if (action === 'setNewPassword') {
      const cmd = new RespondToAuthChallengeCommand({
        ClientId:           CLIENT_ID,
        ChallengeName:      'NEW_PASSWORD_REQUIRED',
        Session:            body.session,
        ChallengeResponses: {
          USERNAME:     body.email,
          NEW_PASSWORD: body.newPassword,
        },
      })
      const res = await client.send(cmd)
      return NextResponse.json({
        accessToken:  res.AuthenticationResult?.AccessToken,
        idToken:      res.AuthenticationResult?.IdToken,
        refreshToken: res.AuthenticationResult?.RefreshToken,
        expiresIn:    res.AuthenticationResult?.ExpiresIn,
      })
    }

    if (action === 'forgotPassword') {
      await client.send(new ForgotPasswordCommand({
        ClientId: CLIENT_ID, Username: body.email,
      }))
      return NextResponse.json({ ok: true })
    }

    if (action === 'confirmForgotPassword') {
      await client.send(new ConfirmForgotPasswordCommand({
        ClientId:         CLIENT_ID,
        Username:         body.email,
        ConfirmationCode: body.code,
        Password:         body.newPassword,
      }))
      return NextResponse.json({ ok: true })
    }

    if (action === 'signUp') {
      const res = await client.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        Password: body.password,
        UserAttributes: [{ Name: 'email', Value: body.email }],
      }))
      return NextResponse.json({ userSub: res.UserSub })
    }

    if (action === 'confirmSignUp') {
      await client.send(new ConfirmSignUpCommand({
        ClientId:         CLIENT_ID,
        Username:         body.email,
        ConfirmationCode: body.code,
      }))
      return NextResponse.json({ ok: true })
    }

    if (action === 'signOut') {
      if (body.accessToken) {
        await client.send(new GlobalSignOutCommand({ AccessToken: body.accessToken }))
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ message: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    const message = err?.message ?? 'Authentication error'
    const status  = err?.name === 'NotAuthorizedException' ? 401 : 500
    return NextResponse.json({ message }, { status })
  }
}