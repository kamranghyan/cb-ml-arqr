import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST() {
  const guestSessionId = randomUUID();

  return NextResponse.json(
    { guestSessionId },
    {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}