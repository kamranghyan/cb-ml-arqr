// src/app/api/admin/users/route.ts
// Uses Cognito's Admin API via the AWS SDK-style JSON POST
import { NextRequest, NextResponse } from 'next/server';

const REGION       = process.env.NEXT_PUBLIC_COGNITO_REGION       ?? 'ap-south-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';

    // Cognito Identity Provider uses AWS Signature V4 — we can't call it with a JWT.
    // Instead, parse the JWT the client sent and extract user info from it,
    // then return that single user's info. For full user list you need AWS credentials.
    // Try to decode the token to at least show the current user.
    if (authHeader) {
      const parts = authHeader.replace('Bearer ', '').split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          const user = {
            id:          payload.sub ?? '',
            username:    payload['cognito:username'] ?? payload.sub ?? '',
            email:       payload.email ?? '',
            name:        payload['custom:display_name'] ?? payload['name'] ?? payload.email?.split('@')[0] ?? 'Admin',
            role:        payload['custom:role'] ?? (payload['cognito:groups']?.includes('menulay_admin') ? 'super_admin' : 'admin'),
            tenantId:    payload['custom:tenant_id'] ?? payload['custom:tenantId'] ?? '',
            tenantName:  payload['custom:tenant_name'] ?? '',
            status:      'CONFIRMED',
            enabled:     true,
            createdAt:   new Date(payload.auth_time * 1000).toISOString(),
            updatedAt:   new Date(payload.iat * 1000).toISOString(),
            mfaEnabled:  false,
            groups:      payload['cognito:groups'] ?? [],
          };
          return NextResponse.json({ users: [user], note: 'Showing current user only. Full user list requires AWS admin credentials.' });
        } catch {}
      }
    }

    return NextResponse.json({ users: [], note: 'No valid token provided.' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 500 });
  }
}