import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      notifications: [],
    });
  } catch (error) {
    console.error('[Guest Notifications] GET error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
      },
      { status: 500 }
    );
  }
}