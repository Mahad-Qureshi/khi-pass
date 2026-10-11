import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { getAuthenticatedUser } from '@/lib/supabase/auth';

async function VerifiedShell({ children }: { children: ReactNode }) {
  const signedIn = Boolean(await getAuthenticatedUser());
  return <AppShell signedIn={signedIn}>{children}</AppShell>;
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="public-loading" aria-label="Loading KHI PASS" />}>
    <VerifiedShell>{children}</VerifiedShell>
  </Suspense>;
}
