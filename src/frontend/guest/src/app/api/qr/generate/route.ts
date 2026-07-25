import { NextRequest, NextResponse } from 'next/server';
import { buildQrUrl, buildS3Key, buildS3Url } from '@/lib/qr';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, tableId, tableNumber, zone, outlet } = body;

    if (!restaurantId || !tableId) {
      return NextResponse.json(
        { error: 'restaurantId and tableId are required' },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      req.headers.get('origin') ??
      'https://digital-menu-jade-iota.vercel.app';

    const encodedUrl = buildQrUrl(baseUrl, restaurantId, tableId);
    const s3Key      = buildS3Key(restaurantId, tableId);
    const s3Url      = buildS3Url(s3Key);

    // Dynamic import — avoids static analysis issues with optional native deps
    const QRCode = (await import('qrcode')).default;

    const pngDataUrl = await QRCode.toDataURL(encodedUrl, {
      width:                400,
      margin:               2,
      color:                { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    const svgString = await QRCode.toString(encodedUrl, {
      type:                 'svg',
      margin:               2,
      color:                { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });

    return NextResponse.json({
      success: true,
      encodedUrl,
      pngDataUrl,
      svgString,
      s3Key,
      s3Url,
      metadata: {
        restaurantId,
        tableId,
        tableNumber,
        zone,
        outlet,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (err: any) {
    console.error('[QR API] error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'QR generation failed' },
      { status: 500 },
    );
  }
}