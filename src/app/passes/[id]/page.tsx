import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { requireAuthenticatedUser, AuthenticationRequiredError } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { getMyPass } from '@/features/drops/pass-data';
import { PassDetailView } from '@/features/drops/components/PassViews';
import { AppShell } from '@/components/shell/AppShell';

export const metadata = { title: 'Your PASS' };
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  await requireAuthenticatedUser().catch((error: unknown) => {
    if (error instanceof AuthenticationRequiredError) redirect(loginPath(`/passes/${id}`));
    throw error;
  });
  let item;
  try { item = await getMyPass(id); }
  catch { return <p role="alert">PASS details are unavailable right now.</p>; }
  if (!item) notFound();
  const qrDataUrl = item.status === 'pending' && item.redemption_code
    ? await QRCode.toDataURL(item.redemption_code, { margin: 1, width: 220, errorCorrectionLevel: 'M' }) : null;
  return <PassDetailView item={item} qrDataUrl={qrDataUrl} />;
}
export default function Page(props: Props) {
  return <Suspense fallback={<div className="public-loading" aria-label="Loading your PASS" />}><AppShell signedIn><Content {...props} /></AppShell></Suspense>;
}
