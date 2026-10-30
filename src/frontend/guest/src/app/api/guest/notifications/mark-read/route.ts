import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const notificationId = body?.notificationId ?? body?.id;

    console.log('📩 [Guest Notifications] Mark as read:', {
      notificationId,
    });

    /*
     * If notifications are currently handled only on the frontend,
     * there is nothing else to persist here.
     *
     * When you connect this to your backend later, this is where
     * you can forward the request to the notification service.
     */

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
      notificationId: notificationId ?? null,
    });
  } catch (error) {
    console.error(
      '❌ [Guest Notifications] Failed to mark notification as read:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark notification as read',
      },
      { status: 500 }
    );
  }
}