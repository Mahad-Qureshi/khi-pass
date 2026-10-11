import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPublicDropBySlug } from '@/features/drops/data';

type Props = { params: Promise<{ slug: string }> };
async function Content({ params }: Props) {
  const { slug } = await params;
  const result = await getPublicDropBySlug(slug);
  if (result.error) return <p role="alert">PASS Drop details are unavailable right now.</p>;
  const item = result.item;
  if (!item) notFound();
  return <article><p>PASS Drop</p><h1>{item.title}</h1><p>{item.description}</p><p>Rs {item.price.toLocaleString('en-PK')}</p><p>Offer ends {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.endsAt))} PKT.</p></article>;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading PASS Drop…</p>}><Content {...props} /></Suspense>; }
