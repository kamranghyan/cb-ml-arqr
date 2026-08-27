import { getValidIdToken } from './cognito';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Plan {
  plan_id: string;
  plan_name: string;
  duration_days: number;
  price: number;
  currency: string;
  description: string | null;
  is_active: boolean;
}

export interface Subscription {
  tenant_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  days_remaining: number | null;
}

// ─────────────────────────────────────────────────────────────
// Fetch helper
// ─────────────────────────────────────────────────────────────

async function subscriptionFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api/auth-svc${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    let message = text;

    try {
      const body = JSON.parse(text);

      message =
        body?.error?.message ??
        body?.error ??
        body?.message ??
        body?.detail ??
        text;
    } catch {
      // Keep raw text
    }

    if (res.status === 401) {
      throw new Error(
        'Session expired — please log in again.'
      );
    }

    if (res.status === 403) {
      throw new Error(
        message || 'You do not have access to this.'
      );
    }

    throw new Error(
      message || `Request failed (${res.status})`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.text();

  if (!body) {
    return undefined as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('Invalid response received from server.');
  }
}

// ─────────────────────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────────────────────

export async function fetchPlans(): Promise<Plan[]> {
  const data = await subscriptionFetch<Plan[]>('/plans');

  return Array.isArray(data) ? data : [];
}

export async function createPlan(
  payload: Omit<Plan, 'is_active'>
): Promise<Plan> {
  return subscriptionFetch<Plan>('/plans/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(
  planId: string,
  payload: Omit<Plan, 'is_active'>
): Promise<Plan> {
  return subscriptionFetch<Plan>(
    `/plans/admin/${encodeURIComponent(planId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

export async function deletePlan(
  planId: string
): Promise<void> {
  await subscriptionFetch<void>(
    `/plans/admin/${encodeURIComponent(planId)}`,
    {
      method: 'DELETE',
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Subscription
// ─────────────────────────────────────────────────────────────

export async function fetchSubscriptionStatus(
  tenantId: string
): Promise<Subscription | null> {

  if (!tenantId) {
    throw new Error('Tenant ID is required.');
  }

  // A subscription ID must never be sent as tenant ID.
  if (tenantId.startsWith('SUB_')) {
    throw new Error(
      `Invalid tenant ID "${tenantId}". ` +
      'fetchSubscriptionStatus requires the actual tenant ID.'
    );
  }

  try {
    return await subscriptionFetch<Subscription>(
      `/subscriptions/status/${encodeURIComponent(tenantId)}`,
      {
        method: 'GET',
        headers: {
          'X-Tenant-Id': tenantId,
        },
      }
    );
  } catch (error: any) {

    // Backend/proxy may return 404 for tenants
    // that do not have a subscription yet.
    if (
      error?.message?.includes('404') ||
      error?.message?.toLowerCase()?.includes('not found')
    ) {
      return null;
    }

    throw error;
  }
}