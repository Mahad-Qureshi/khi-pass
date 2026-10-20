import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { getMerchantMemberships, requireMerchant } from '@/features/merchant/data';
import { MerchantWorkspace } from '@/features/merchant/components/MerchantWorkspace';

type Props = { children: ReactNode; params: Promise<{ merchantId: string }> };

async function WorkspaceShell({ children, params }: { children: ReactNode; params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const membership = await requireMerchant(merchantId);
  const memberships = await getMerchantMemberships(`/merchant/${merchantId}`);
  return <AppShell signedIn><MerchantWorkspace membership={membership} memberships={memberships}>
    {children}
  </MerchantWorkspace></AppShell>;
}

export default function MerchantLayout({ children, params }: Props) {
  return <Suspense fallback={<p role="status">Loading merchant workspace…</p>}>
    <WorkspaceShell params={params}>{children}</WorkspaceShell>
  </Suspense>;
}
