import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAuthenticatedUser, AuthenticationRequiredError } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { getMyPasses } from '@/features/drops/pass-data';
import { PassListView } from '@/features/drops/components/PassViews';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = { title: 'My PASSes' };
type Props = { searchParams: Promise<{ page?: string }> };
async function Content({ searchParams }: Props) {
  await requireAuthenticatedUser().catch((error: unknown) => {
    if (error instanceof AuthenticationRequiredError) redirect(loginPath('/passes'));
    throw error;
  });
  const raw = (await searchParams).page;
  const page = z.coerce.number().int().min(0).max(500).safeParse(raw ?? '0');
  if (!page.success) return <p role="alert">Invalid page number.</p>;
  const result = await getMyPasses(page.data).catch(() => null);
  if (!result) return <p role="alert">My PASSes are unavailable right now.</p>;
  return <PassListView items={result.items} total={result.total} page={page.data} />;
}
export default function Page(props: Props) {
  return <Suspense fallback={<div className="public-loading" aria-label="Loading My PASSes" />}><AppShell signedIn><Content {...props} /></AppShell></Suspense>;
}
