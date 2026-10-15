import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAuthenticatedUser, AuthenticationRequiredError } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { loginPath } from '@/features/auth/redirect';
import { RedeemForm } from '@/features/drops/components/RedeemForm';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = { title: 'Redeem a PASS' };
async function Content() {
  const user = await requireAuthenticatedUser().catch((error: unknown) => {
    if (error instanceof AuthenticationRequiredError) redirect(loginPath('/merchant/redeem'));
    throw error;
  });
  const client = await createClient();
  const { data, error } = await client.from('merchant_members').select('merchant_id').eq('user_id', user.id).limit(1);
  if (error) return <p role="alert">Merchant access is unavailable right now.</p>;
  if (!data?.length) return <p role="alert">Merchant membership is required to redeem a PASS.</p>;
  return <RedeemForm />;
}
export default function Page() {
  return <Suspense fallback={<div className="public-loading" aria-label="Checking merchant access" />}><AppShell signedIn><Content /></AppShell></Suspense>;
}
