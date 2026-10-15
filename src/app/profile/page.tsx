import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, AuthenticationRequiredError } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { loginPath } from '@/features/auth/redirect';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ProfileCard } from '@/features/auth/components/ProfileCard';

export const metadata = { title: 'Your profile' };
async function Profile() {
    const user = await requireAuthenticatedUser().catch((error: unknown) => {
        if (error instanceof AuthenticationRequiredError) redirect(loginPath('/profile'));
        throw error;
    });
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('display_name,avatar_url').eq('id', user.id).maybeSingle();
    const membership = await supabase.from('merchant_members').select('merchant_id').eq('user_id', user.id).limit(1);
    return <ProfileCard displayName={data?.display_name ?? null} avatar={data?.avatar_url ?? null} email={user.email ?? null} unavailable={!!error || !data} merchantAccess={!!membership.data?.length} />;
}
export default function Page() {
    return <Suspense fallback={<AuthShell title="Your profile"><p>Loading…</p></AuthShell>}><Profile /></Suspense>;
}
