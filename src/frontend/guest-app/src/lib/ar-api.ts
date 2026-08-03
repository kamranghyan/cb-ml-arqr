export interface ArApiResponse {
  itemId:       string;
  restaurantId: string;
  presignedUrl: string;
  expiresIn:    number;
  cfDomain:     string;
}

/**
 * Fetch a presigned GLB URL via our server-side proxy (/api/ar).
 * restaurantId and itemId are always dynamic — never hardcoded.
 */
export async function fetchArModel(
  restaurantId: string,
  itemId: string,
): Promise<ArApiResponse> {
  if (!restaurantId || !itemId) {
    throw new Error('restaurantId and itemId are required');
  }
  const url = `/api/ar?rid=${encodeURIComponent(restaurantId)}&iid=${encodeURIComponent(itemId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AR proxy error ${res.status}: ${body}`);
  }
  return res.json() as Promise<ArApiResponse>;
}