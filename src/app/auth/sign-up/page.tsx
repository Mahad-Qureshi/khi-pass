import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { safeNext } from '@/features/auth/redirect';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { AuthForm } from '@/features/auth/components/AuthForm';

export const metadata = { title: 'Create account' };
type Props = { searchParams: Promise<{ next?: string }> };
async function SignUp({ searchParams }: Props) {
    const next = safeNext((await searchParams).next);
    if (await getAuthenticatedUser()) redirect(next);
    return <AuthShell title="Create your account" description="Start exploring Karachi with KHI PASS.">
        <AuthForm mode="sign-up" next={next} />
    </AuthShell>;
}
export default function Page(props: Props) {
    return <Suspense fallback={<AuthShell title="Create account"><p>Loading…</p></AuthShell>}><SignUp {...props} /></Suspense>;
}
