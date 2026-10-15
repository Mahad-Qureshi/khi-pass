import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPublicDropOfferBySlug } from '@/features/drops/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { ClaimControl } from '@/features/drops/components/ClaimControl';

type Props = { params: Promise<{ slug: string }> };
async function Content({ params }: Props) {
  const { slug } = await params;
  const [result, user] = await Promise.all([getPublicDropOfferBySlug(slug), getAuthenticatedUser().catch(() => null)]);
  if (result.error) return <p role="alert">PASS Drop details are unavailable right now.</p>;
  const item = result.item;
  if (!item) notFound();
  return <article><p>PASS Drop</p><h1>{item.title}</h1><p>{item.description}</p>
    <p>Rs {item.price.toLocaleString('en-PK')}{item.originalPrice !== null ? ` · Regular Rs ${item.originalPrice.toLocaleString('en-PK')}` : ''}</p>
    <p>Offer ends {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.endsAt))} PKT.</p>
    <p>{item.remaining === null ? 'Stock is currently unavailable.' : `${item.remaining} PASSes remaining.`} Limit {item.perUserLimit} per person.</p>
    <p>After claiming, show the redemption code within {Math.ceil(item.redemptionLifetimeSeconds / 60)} minutes or before the offer ends, whichever is earlier.</p>
    <p>Terms: {item.terms}</p>
    <ClaimControl dropId={item.id} claimable={item.claimable} signedIn={Boolean(user)} loginHref={loginPath(`/drops/${slug}`)} />
  </article>;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading PASS Drop…</p>}><Content {...props} /></Suspense>; }
