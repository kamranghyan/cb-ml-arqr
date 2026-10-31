import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? 'ap-south-1'
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_BASE
const client = new CognitoIdentityProviderClient({ region: REGION })

async function callAuthService(path: string, body: object) {
  if (!AUTH_API) {
    return NextResponse.json({ error: 'Authentication service is not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${AUTH_API.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await response.text()
    let data: unknown = {}

    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { message: text }
    }

    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action as string

    if (action === 'login') {
      return callAuthService('/auth/login', { email: body.email, password: body.password })
    }

    if (action === 'refresh') {
      return callAuthService('/auth/refresh', { refreshToken: body.refreshToken })
    }

    if (!CLIENT_ID) {
      return NextResponse.json({ error: 'Cognito client is not configured' }, { status: 500 })
    }

    if (action === 'setNewPassword') {
      const result = await client.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: body.session,
        ChallengeResponses: { USERNAME: body.email, NEW_PASSWORD: body.newPassword },
      }))
      return NextResponse.json({
        accessToken: result.AuthenticationResult?.AccessToken,
        idToken: result.AuthenticationResult?.IdToken,
        refreshToken: result.AuthenticationResult?.RefreshToken,
        expiresIn: result.AuthenticationResult?.ExpiresIn,
      })
    }

    if (action === 'forgotPassword') {
      await client.send(new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: body.email }))
      return NextResponse.json({ ok: true })
    }

    if (action === 'confirmForgotPassword') {
      await client.send(new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        ConfirmationCode: body.code,
        Password: body.newPassword,
      }))
      return NextResponse.json({ ok: true })
    }

    if (action === 'signUp') {
      const result = await client.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        Password: body.password,
        UserAttributes: [{ Name: 'email', Value: body.email }],
      }))
      return NextResponse.json({ userSub: result.UserSub })
    }

    if (action === 'confirmSignUp') {
      await client.send(new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
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

    return NextResponse.json({ error: `Unknown auth action: ${action}` }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Authentication error' },
      { status: error?.name === 'NotAuthorizedException' ? 401 : 500 },
    )
  }
}
