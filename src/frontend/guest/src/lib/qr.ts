/**
 * QR Code Module
 * Encodes restaurantId + tableId into a URL, generates QR PNG/SVG,
 * and simulates S3 storage.
 */

import type { QrRecord, QrGenerateRequest } from './types';

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? '';

// ── URL encoding ──────────────────────────────────────────────────────────────

export function buildQrUrl(
  baseUrl: string,
  restaurantId: string,
  tableId: string,
): string {
  const url = new URL('/guest', baseUrl);
  url.searchParams.set('rid', restaurantId);
  url.searchParams.set('tid', tableId);
  return url.toString();
}

// ── S3 key & URL ──────────────────────────────────────────────────────────────

export function buildS3Key(restaurantId: string, tableId: string): string {
  return `qr-codes/${restaurantId}/${tableId}.png`;
}

export function buildS3Url(s3Key: string): string {
  return `https://lamaison-assets.s3.ap-south-1.amazonaws.com/${s3Key}`;
}

// ── QR record factory ─────────────────────────────────────────────────────────

export function createQrRecord(req: QrGenerateRequest): QrRecord {
  const tableId    = req.tableId || `T${req.tableNumber.padStart(2, '0')}`;
  const encodedUrl = buildQrUrl(req.baseUrl, req.restaurantId, tableId);
  const s3Key      = buildS3Key(req.restaurantId, tableId);

  return {
    id:           crypto.randomUUID(),
    restaurantId: req.restaurantId,
    tableId,
    tableNumber:  req.tableNumber,
    zone:         req.zone,
    outlet:       req.outlet,
    encodedUrl,
    s3Key,
    s3Url:        buildS3Url(s3Key),
    createdAt:    new Date().toISOString(),
    linked:       true,
  };
}

// ── Seed data — generated lazily on the client only ──────────────────────────
// NOTE: INITIAL_QR_RECORDS uses a fixed base URL so it is safe to import
// from server components too (no window access at module level).

const DEFAULT_BASE = 'https://digital-menu-three-olive.vercel.app';

function makeSeeds(): QrRecord[] {
  const mainHall = Array.from({ length: 8 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return createQrRecord({
      restaurantId: RESTAURANT_ID,
      tableId:      `T${num}`,
      tableNumber:  num,
      zone:         'Main Hall',
      outlet:       'Main Hall',
      baseUrl:      DEFAULT_BASE,
    });
  });

  const other = Array.from({ length: 4 }, (_, i) => {
    const num = String(i + 9).padStart(2, '0');
    const zone = i < 2 ? 'Garden Terrace' : 'Private Dining';
    return createQrRecord({
      restaurantId: RESTAURANT_ID,
      tableId:      `T${num}`,
      tableNumber:  num,
      zone,
      outlet:       zone,
      baseUrl:      DEFAULT_BASE,
    });
  });

  return [...mainHall, ...other];
}

export const INITIAL_QR_RECORDS: QrRecord[] = makeSeeds();