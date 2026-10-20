import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DropEditor, ExperienceEditor, VenueEditor } from '@/features/merchant/components/Editors';
import { ExperienceAvailability } from '@/features/merchant/components/ExperienceAvailability';
import { MerchantContentActions } from '@/features/merchant/components/MerchantWorkspace';
import { canManage, merchantExperienceExtras, merchantReferences, requireMerchant } from '@/features/merchant/data';
import { merchantKind, uuid } from '@/features/merchant/schema';
import { createClient } from '@/lib/supabase/server';

async function EditContent({ params }: {
  params: Promise<{ merchantId: string; kind: string; id: string }>;
}) {
  const { merchantId, kind: kindValue, id } = await params;
  const kind = merchantKind.safeParse(kindValue);
  if (!kind.success || !uuid.safeParse(id).success) notFound();
  const member = await requireMerchant(merchantId);
  if (!canManage(member)) notFound();
  const client = await createClient();
  const refs = await merchantReferences(merchantId);
  if (kind.data === 'venues') {
    const { data, error } = await client.from('venues').select('*').eq('id', id).eq('merchant_id', merchantId).maybeSingle();
    if (error || !data) notFound();
    return <><VenueEditor merchantId={merchantId} record={data} areas={refs.areas} />
      <MerchantContentActions merchantId={merchantId} kind="venues" id={id} status={data.status} /></>;
  }
  if (kind.data === 'experiences') {
    const { data, error } = await client.from('experiences').select('*').eq('id', id).eq('merchant_id', merchantId).maybeSingle();
    if (error || !data) notFound();
    const extras = await merchantExperienceExtras(merchantId, id);
    return <><ExperienceEditor merchantId={merchantId} record={data} venues={refs.venues} categories={refs.categories} />
      <ExperienceAvailability {...extras} />
      <MerchantContentActions merchantId={merchantId} kind="experiences" id={id} status={data.status} /></>;
  }
  const { data, error } = await client.from('drops').select('*').eq('id', id).eq('merchant_id', merchantId).maybeSingle();
  if (error || !data) notFound();
  return <><DropEditor merchantId={merchantId} record={data} venues={refs.venues} experiences={refs.experiences} />
    <MerchantContentActions merchantId={merchantId} kind="drops" id={id} status={data.status} /></>;
}

export default function EditMerchantContent({ params }: { params: Promise<{ merchantId: string; kind: string; id: string }> }) {
  return <Suspense fallback={<p role="status">Loading merchant record…</p>}><EditContent params={params} /></Suspense>;
}
