// src/app/api/auth/route.ts
// Uses AWS SDK — most reliable way to call Cognito from Node.js

import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION    = 'ap-south-1'
const CLIENT_ID = '7903hkujl9qeq67toemi5qrhes'

const client = new CognitoIdentityProviderClient({ region: REGION })

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const action = body.action as string

    if (action === 'login') {
      const cmd = new InitiateAuthCommand({
        AuthFlow:       'USER_PASSWORD_AUTH',
        ClientId:       CLIENT_ID,
        AuthParameters: { USERNAME: body.email, PASSWORD: body.password },
      })
      const res = await client.send(cmd)
      if (res.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return NextResponse.json({ challenge: 'NEW_PASSWORD_REQUIRED', session: res.Session })
      }
      return NextResponse.json({
        accessToken:  res.AuthenticationResult?.AccessToken,
        idToken:      res.AuthenticationResult?.IdToken,
        refreshToken: res.AuthenticationResult?.RefreshToken,
        expiresIn:    res.AuthenticationResult?.ExpiresIn,
      })
    }

    if (action === 'setNewPassword') {
      const cmd = new RespondToAuthChallengeCommand({
        ChallengeName:      'NEW_PASSWORD_REQUIRED',
        ClientId:           CLIENT_ID,
        Session:            body.session,
        ChallengeResponses: { USERNAME: body.email, NEW_PASSWORD: body.newPassword },
      })
      const res = await client.send(cmd)
      return NextResponse.json({
        accessToken:  res.AuthenticationResult?.AccessToken,
        idToken:      res.AuthenticationResult?.IdToken,
        refreshToken: res.AuthenticationResult?.RefreshToken,
        expiresIn:    res.AuthenticationResult?.ExpiresIn,
      })
    }

    if (action === 'refresh') {
      const cmd = new InitiateAuthCommand({
        AuthFlow:       'REFRESH_TOKEN_AUTH',
        ClientId:       CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: body.refreshToken },
      })
      const res = await client.send(cmd)
      return NextResponse.json({
        accessToken: res.AuthenticationResult?.AccessToken,
        idToken:     res.AuthenticationResult?.IdToken,
        expiresIn:   res.AuthenticationResult?.ExpiresIn,
      })
    }

    if (action === 'forgotPassword') {
      await client.send(new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: body.email }))
      return NextResponse.json({ success: true })
    }

    if (action === 'confirmForgotPassword') {
      await client.send(new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID, Username: body.email,
        ConfirmationCode: body.code, Password: body.newPassword,
      }))
      return NextResponse.json({ success: true })
    }

    if (action === 'signUp') {
      await client.send(new SignUpCommand({
        ClientId: CLIENT_ID, Username: body.email, Password: body.password,
        UserAttributes: [
          { Name: 'email',               Value: body.email },
          { Name: 'custom:role',         Value: 'tenant' },
          { Name: 'custom:tenant_name',  Value: body.restaurantName },
          { Name: 'custom:display_name', Value: body.restaurantName },
        ],
      }))
      return NextResponse.json({ success: true })
    }

    if (action === 'confirmSignUp') {
      await client.send(new ConfirmSignUpCommand({
        ClientId: CLIENT_ID, Username: body.email, ConfirmationCode: body.code,
      }))
      return NextResponse.json({ success: true })
    }

    if (action === 'signOut') {
      await client.send(new GlobalSignOutCommand({ AccessToken: body.accessToken }))
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[auth] error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}