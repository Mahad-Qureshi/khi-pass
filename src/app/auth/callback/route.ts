import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext, loginPath } from '@/features/auth/redirect';
import { initializeDisplayName } from '@/features/auth/profile';

export async function GET(request: NextRequest) {
    // NextURL normalizes loopback IPs to localhost; keep cookie and redirect hosts aligned.
    const origin = new URL(request.nextUrl.origin);
    if (origin.hostname === 'localhost') {
        try {
            const incoming = new URL(origin.protocol + '//' + request.headers.get('host'));
            if (['localhost', '127.0.0.1', '[::1]'].includes(incoming.hostname) && incoming.port === origin.port && !incoming.username && !incoming.password) {
                origin.hostname = incoming.hostname;
            }
        } catch { /* Retain the framework origin for malformed headers. */ }
    }
    const next = safeNext(request.nextUrl.searchParams.get('next'));
    const code = request.nextUrl.searchParams.get('code');
    const cacheHeaders = new Headers({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    let destination = loginPath(next) + '&error=callback';
    if (code && code.length <= 4096 && !request.nextUrl.searchParams.has('error')) {
        try {
            const supabase = await createClient(cacheHeaders);
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
                const { data, error: userError } = await supabase.auth.getUser();
                if (!userError && data.user) {
                    await initializeDisplayName(supabase, data.user);
                    destination = next;
                }
            }
        } catch {
            // Return only a fixed public error; never log codes, tokens or provider details.
        }
    }
    const response = NextResponse.redirect(new URL(destination, origin.origin), 303);
    cacheHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
}
