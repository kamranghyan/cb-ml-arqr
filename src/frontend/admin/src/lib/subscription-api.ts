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
    whats_included?: string[];
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

export interface SubscribeResponse
    extends Subscription {}

export interface SubscribePayload {
    planId: string;
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
        headers.Authorization =
            `Bearer ${token}`;
    }

    const res = await fetch(
        `/api/auth-svc${path}`,
        {
            ...options,
            headers,
            cache: 'no-store',
        }
    );

    const text =
        await res.text().catch(() => '');

    let body: any = null;

    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = null;
        }
    }

    if (!res.ok) {
        const message =
            body?.error?.message ??
            body?.error ??
            body?.message ??
            body?.detail ??
            text ??
            `Request failed (${res.status})`;

        if (res.status === 401) {
            throw new Error(
                'Session expired — please log in again.'
            );
        }

        if (res.status === 403) {
            throw new Error(
                message ||
                'You do not have access to this.'
            );
        }

        if (res.status === 404) {
            throw new Error(
                message ||
                'Resource not found.'
            );
        }

        throw new Error(
            message ||
            `Request failed (${res.status})`
        );
    }

    if (
        res.status === 204 ||
        !text
    ) {
        return undefined as T;
    }

    return body as T;
}

// ─────────────────────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────────────────────

export async function fetchPlans(): Promise<Plan[]> {
    const data =
        await subscriptionFetch<Plan[]>(
            '/plans'
        );

    return Array.isArray(data)
        ? data
        : [];
}

export async function createPlan(
    payload: Omit<Plan, 'is_active'>
): Promise<Plan> {
    return subscriptionFetch<Plan>(
        '/plans/admin',
        {
            method: 'POST',

            body: JSON.stringify(payload),
        }
    );
}

export async function updatePlan(
    planId: string,
    payload: Omit<Plan, 'is_active'>
): Promise<Plan> {
    if (!planId) {
        throw new Error(
            'Plan ID is required.'
        );
    }

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
    if (!planId) {
        throw new Error(
            'Plan ID is required.'
        );
    }

    await subscriptionFetch<void>(
        `/plans/admin/${encodeURIComponent(planId)}`,
        {
            method: 'DELETE',
        }
    );
}

// ─────────────────────────────────────────────────────────────
// Subscribe to Plan
// ─────────────────────────────────────────────────────────────

export async function subscribeToPlan(
    planId: string
): Promise<Subscription> {
    if (!planId) {
        throw new Error(
            'Plan ID is required.'
        );
    }

    console.log(
        '📦 [SUBSCRIPTION] Creating subscription:',
        {
            planId,
        }
    );

    return subscriptionFetch<Subscription>(
        '/subscriptions/subscribe',
        {
            method: 'POST',

            // IMPORTANT:
            // Backend expects `plan_id`, not `planId`.
            body: JSON.stringify({
                plan_id: planId,
            }),
        }
    );
}

// ─────────────────────────────────────────────────────────────
// Subscription Status
// ─────────────────────────────────────────────────────────────

export async function fetchSubscriptionStatus(
    tenantId: string
): Promise<Subscription | null> {
    if (!tenantId) {
        throw new Error(
            'Tenant ID is required.'
        );
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
        const message =
            error?.message
                ?.toLowerCase?.() ?? '';

        // Tenant may not have a subscription yet.
        if (
            message.includes('404') ||
            message.includes('not found')
        ) {
            return null;
        }

        throw error;
    }
}