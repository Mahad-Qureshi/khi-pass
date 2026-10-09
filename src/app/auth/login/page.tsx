import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { safeNext } from '@/features/auth/redirect';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { AuthForm } from '@/features/auth/components/AuthForm';

export const metadata = { title: 'Sign in' };
type Props = { searchParams: Promise<{ next?: string; error?: string }> };
async function Login({ searchParams }: Props) {
    const params = await searchParams;
    const next = safeNext(params.next);
    if (await getAuthenticatedUser()) redirect(next);
    return <AuthShell title="Welcome back" description="Sign in to your KHI PASS account.">
        <AuthForm mode="login" next={next} callbackError={params.error === 'callback'} />
    </AuthShell>;
}
export default function Page(props: Props) {
    return <Suspense fallback={<AuthShell title="Sign in"><p>Loading…</p></AuthShell>}><Login {...props} /></Suspense>;
}
