import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.types';

import { getSupabaseEnv } from './env';

export async function updateSession(request: NextRequest) {
    const { url, publishableKey } = getSupabaseEnv();
    let response = NextResponse.next({ request });

    // Auth cookies and personalized responses must never enter a shared cache.
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    response.headers.set('Expires', '0');
    response.headers.set('Pragma', 'no-cache');

    // Create a separate server client for every request.
    const supabase = createServerClient<Database>(url, publishableKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, cacheHeaders) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

                const previousResponse = response;
                response = NextResponse.next({ request });
                previousResponse.headers.forEach((value, name) => {
                    // NextResponse.next generated fresh request overrides above.
                    if (name !== 'set-cookie' && name !== 'x-middleware-override-headers' &&
                        !name.startsWith('x-middleware-request-')) {
                        response.headers.set(name, value);
                    }
                });
                previousResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
                Object.entries(cacheHeaders).forEach(([name, value]) => {
                    response.headers.set(name, value);
                });
            },
        },
    });

    // Refresh/verify before rendering. Route helpers perform authorization separately.
    // An absent or invalid session must not redirect visitors away from public pages.
    await supabase.auth.getClaims();
    return response;
}
