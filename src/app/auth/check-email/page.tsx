import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Typography, Link as MuiLink } from '@mui/material';
import Link from '@/components/common/Link';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { safeNext, loginPath } from '@/features/auth/redirect';
import { AuthShell } from '@/features/auth/components/AuthShell';

export const metadata = { title: 'Check your email' };
type Props = { searchParams: Promise<{ next?: string }> };
async function CheckEmail({ searchParams }: Props) {
    const next = safeNext((await searchParams).next);
    if (await getAuthenticatedUser()) redirect(next);
    return <AuthShell title="Check your email" description="If your account needs confirmation, youâ€™ll receive an email with the next steps.">
        <Typography component="p" gutterBottom>Open the confirmation link in the same browser where you signed up. Check your spam folder too.</Typography>
        <MuiLink component={Link} prefetch={false} href={loginPath(next)}>Return to sign in</MuiLink>
    </AuthShell>;
}
export default function Page(props: Props) {
    return <Suspense fallback={<AuthShell title="Check your email"><p>Loadingâ€¦</p></AuthShell>}><CheckEmail {...props} /></Suspense>;
}
