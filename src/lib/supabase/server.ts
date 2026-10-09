import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database.types';

import { getSupabaseEnv } from './env';

// Route Handlers can pass their outgoing Headers to retain SSR cache headers.
// Proxy also prevents shared caching on every matched request, including Server Actions.
export async function createClient(responseHeaders?: Headers) {
    const { url, publishableKey } = getSupabaseEnv();
    const cookieStore = await cookies();

    return createServerClient<Database>(url, publishableKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet, cacheHeaders) {
                Object.entries(cacheHeaders).forEach(([name, value]) => {
                    responseHeaders?.set(name, value);
                });
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Server Components cannot write cookies. Proxy refreshes them first.
                }
            },
        },
    });
}
