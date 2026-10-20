import { Suspense } from 'react';
import { Alert } from '@mui/material';
import { notFound } from 'next/navigation';
import { DropEditor, ExperienceEditor, VenueEditor } from '@/features/merchant/components/Editors';
import { canManage, merchantReferences, requireMerchant } from '@/features/merchant/data';
import { merchantKind } from '@/features/merchant/schema';

async function NewContent({ params }: {
  params: Promise<{ merchantId: string; kind: string }>;
}) {
  const { merchantId, kind: kindValue } = await params;
  const kind = merchantKind.safeParse(kindValue);
  if (!kind.success) notFound();
  const member = await requireMerchant(merchantId);
  if (!canManage(member)) notFound();
  const refs = await merchantReferences(merchantId);
  if (kind.data === 'venues') return <VenueEditor merchantId={merchantId} areas={refs.areas} />;
  if (!refs.venues.length) return <Alert severity="info">Create a venue before adding experiences or PASS Drops.</Alert>;
  if (kind.data === 'experiences') return <ExperienceEditor merchantId={merchantId} venues={refs.venues} categories={refs.categories} />;
  return <DropEditor merchantId={merchantId} venues={refs.venues} experiences={refs.experiences} />;
}

export default function NewMerchantContent({ params }: { params: Promise<{ merchantId: string; kind: string }> }) {
  return <Suspense fallback={<p role="status">Loading merchant form…</p>}><NewContent params={params} /></Suspense>;
}
