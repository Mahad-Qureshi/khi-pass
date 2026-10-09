import { NextResponse } from 'next/server';

import { getSupabaseEnv, SupabaseConfigurationError } from '@/lib/supabase/env';

const responseHeaders = { 'Cache-Control': 'private, no-store' };

function failure(status: string, httpStatus: number) {
    return NextResponse.json(
        { ok: false, service: 'supabase', status },
        { status: httpStatus, headers: responseHeaders },
    );
}

export async function GET() {
    if (process.env.NODE_ENV !== 'development') {
        return new NextResponse(null, { status: 404, headers: responseHeaders });
    }

    try {
        const { url, publishableKey } = getSupabaseEnv();
        // Documented public Auth settings endpoint: read-only, no user or app tables needed.
        // This verifies Auth/API connectivity, not database access or user authentication.
        const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
            headers: { apikey: publishableKey, Accept: 'application/json' },
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(10_000),
        });

        if (response.status === 401 || response.status === 403) {
            return failure('authentication_error', 502);
        }
        if (!response.ok) return failure('service_error', 502);

        const settings: unknown = await response.json();
        if (!settings || typeof settings !== 'object' || !('external' in settings)) {
            return failure('invalid_service_response', 502);
        }

        return NextResponse.json(
            { ok: true, service: 'supabase', status: 'connected' },
            { headers: responseHeaders },
        );
    } catch (error) {
        return error instanceof SupabaseConfigurationError
            ? failure('configuration_error', 500)
            : failure('connection_error', 503);
    }
}
