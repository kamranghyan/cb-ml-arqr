/**
 * Guest Orders WebSocket
 *
 * Used by the Guest app to receive real-time order updates.
 * This is intentionally separate from the KDS order-api.ts.
 */

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  'wss://x0ev8z7gwg.execute-api.ap-south-1.amazonaws.com/dev';

/**
 * Connect guest session to the Orders WebSocket.
 *
 * Guest session must already exist in sessionStorage as:
 * guestSessionId
 */
export function connectWebSocket(): WebSocket {
  if (typeof window === 'undefined') {
    throw new Error('WebSocket can only be connected from the browser.');
  }

  const guestSessionId = sessionStorage.getItem('guestSessionId');

  if (!guestSessionId) {
    throw new Error(
      'Unable to connect WebSocket: no guest session found.'
    );
  }

  const url = `${WS_URL}?guestSessionId=${encodeURIComponent(guestSessionId)}`;

  console.log('[Guest WS] Connecting:', guestSessionId);

  return new WebSocket(url);
}