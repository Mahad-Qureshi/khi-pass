'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, signUpSchema } from './schemas/auth';
import { safeNext } from './redirect';
import { initializeDisplayName } from './profile';

export type AuthResult = { error: string } | { destination: string };

export async function authenticate(mode: 'login' | 'sign-up', input: unknown, next: unknown): Promise<AuthResult> {
    const schema = mode === 'login' ? loginSchema : mode === 'sign-up' ? signUpSchema : null;
    const parsed = schema?.safeParse(input);
    if (!parsed?.success) return { error: 'Check your details and try again.' };
    const destination = safeNext(next);
    try {
        const supabase = await createClient();
        const { email, password, displayName } = parsed.data;
        if (mode === 'login') {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data.user || !data.session) return { error: 'Unable to sign in. Check your details and try again.' };
            await initializeDisplayName(supabase, data.user);
        } else {
            const requestHeaders = await headers();
            const origin = requestHeaders.get('origin');
            if (!origin) return { error: 'Unable to sign up. Reload the page and try again.' };
            const originUrl = new URL(origin);
            const expectedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
            if (originUrl.host !== expectedHost || (originUrl.protocol !== 'https:' &&
                !(originUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname)))) {
                return { error: 'Unable to sign up. Reload the page and try again.' };
            }
            const callback = new URL('/auth/callback', originUrl.origin);
            callback.searchParams.set('next', destination);
            const { data, error } = await supabase.auth.signUp({
                email, password, options: { data: { display_name: displayName }, emailRedirectTo: callback.toString() },
            });
            if (error || !data.user) return { error: 'Unable to create an account. Check your details or try again later.' };
            if (!data.session) return { destination: '/auth/check-email?next=' + encodeURIComponent(destination) };
            await initializeDisplayName(supabase, data.user);
        }
        revalidatePath('/', 'layout');
        return { destination };
    } catch {
        return { error: 'Unable to complete authentication. Please try again.' };
    }
}

export async function logout(): Promise<{ error: string } | never> {
    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) return { error: 'Unable to sign out. Please try again.' };
    } catch {
        return { error: 'Unable to sign out. Please try again.' };
    }
    revalidatePath('/', 'layout');
    redirect('/auth/login');
}
