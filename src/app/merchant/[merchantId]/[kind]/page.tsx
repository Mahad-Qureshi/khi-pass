import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MerchantListing } from '@/features/merchant/components/MerchantWorkspace';
import { canManage, merchantContentList, requireMerchant } from '@/features/merchant/data';
import { merchantKind } from '@/features/merchant/schema';

async function ItemsContent({ params, searchParams }: {
  params: Promise<{ merchantId: string; kind: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { merchantId, kind: inputKind } = await params;
  const kind = merchantKind.safeParse(inputKind);
  if (!kind.success) notFound();
  const member = await requireMerchant(merchantId);
  const rawPage = (await searchParams).page ?? '1';
  const page = /^\d{1,5}$/.test(rawPage) ? Math.max(1, Math.min(1000, Number(rawPage))) : 1;
  const result = await merchantContentList(merchantId, kind.data, page);
  return <MerchantListing merchantId={merchantId} kind={kind.data} editable={canManage(member)}
    items={result.items} page={page} total={result.total} />;
}

export default function MerchantItems(props: {
  params: Promise<{ merchantId: string; kind: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return <Suspense fallback={<p role="status">Loading merchant records…</p>}><ItemsContent {...props} /></Suspense>;
}
