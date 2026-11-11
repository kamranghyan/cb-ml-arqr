import { AR_API_BASE, tenantHeaders } from '@/lib/api-config';

export interface ArApiResponse {
  itemId:       string;
  restaurantId: string;
  presignedUrl: string;
  expiresIn:    number;
  cfDomain:     string;
}

export async function fetchArModel(
  restaurantId: string,
  itemId: string,
): Promise<ArApiResponse> {
  if (!restaurantId || !itemId) {
    throw new Error('restaurantId and itemId are required');
  }
  const url = `${AR_API_BASE}/ar/${encodeURIComponent(restaurantId)}/${encodeURIComponent(itemId)}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(await tenantHeaders(restaurantId)) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AR API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<ArApiResponse>;
}