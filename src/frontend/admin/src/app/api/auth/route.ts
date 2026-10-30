// src/app/api/auth/route.ts

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
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID

// auth_svc — the service that owns login, registration and tenants.
const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_BASE

const client = new CognitoIdentityProviderClient({ region: REGION })

/** Forward to auth_svc and normalise its error envelope. */
async function callAuthSvc(path: string, body: object) {
  try {
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

    // Log the response for debugging
    console.log(`📡 Auth SVC response (${path}):`, {
      status: res.status,
      data: data
    })

    return NextResponse.json(data, {
      status: res.status,
    })
  } catch (error) {
    console.error('❌ Error calling auth_svc:', error)
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 503 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action as string

    console.log(`🔐 Auth action: ${action}`)

    if (action === 'login') {
      return callAuthSvc('/auth/login', {
        email: body.email,
        password: body.password,
      })
    }

    if (action === 'refresh') {
      // Make sure refreshToken is provided
      if (!body.refreshToken) {
        return NextResponse.json(
          { error: 'Refresh token required' },
          { status: 400 }
        )
      }
      
      const response = await callAuthSvc('/auth/refresh', {
        refreshToken: body.refreshToken,
      })
      
      // Log the response for debugging
      const data = await response.json()
      console.log('🔄 Refresh response:', {
        hasAccessToken: !!data.accessToken,
        hasIdToken: !!data.idToken,
        expiresIn: data.expiresIn
      })
      
      return response
    }

    // Handle other Cognito actions directly if needed
    if (action === 'forgotPassword') {
      // Direct Cognito call for password reset
      const command = new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
      })
      
      const result = await client.send(command)
      return NextResponse.json({ 
        success: true, 
        message: 'Password reset code sent' 
      })
    }

    if (action === 'confirmForgotPassword') {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        ConfirmationCode: body.code,
        Password: body.newPassword,
      })
      
      await client.send(command)
      return NextResponse.json({ 
        success: true, 
        message: 'Password reset successful' 
      })
    }

    if (action === 'signup') {
      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        Password: body.password,
        UserAttributes: [
          { Name: 'email', Value: body.email },
          ...(body.name ? [{ Name: 'name', Value: body.name }] : []),
        ],
      })
      
      const result = await client.send(command)
      return NextResponse.json({ 
        success: true, 
        userSub: result.UserSub 
      })
    }

    if (action === 'confirmSignup') {
      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: body.email,
        ConfirmationCode: body.code,
      })
      
      await client.send(command)
      return NextResponse.json({ 
        success: true, 
        message: 'Email confirmed successfully' 
      })
    }

    if (action === 'logout') {
      const command = new GlobalSignOutCommand({
        AccessToken: body.accessToken,
      })
      
      await client.send(command)
      return NextResponse.json({ 
        success: true, 
        message: 'Logged out successfully' 
      })
    }

    return NextResponse.json(
      { error: `Unknown auth action: ${action}` },
      { status: 400 }
    )
  } catch (err: any) {
    console.error('❌ Auth API error:', err)
    const message = err?.message ?? 'Authentication error'
    
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}