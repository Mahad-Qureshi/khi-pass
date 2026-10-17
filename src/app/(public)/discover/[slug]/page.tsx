import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getReferenceData } from '@/features/discovery/reference-data';
import { getPublicExperiences } from '@/features/discovery/data';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { myFavoriteIds } from '@/features/plans/data';
import { FavoriteButton } from '@/features/plans/components/FavoriteButton';

type Props = { params: Promise<{ slug: string }> };
async function Content({ params }: Props) {
  const [{ slug }, refs] = await Promise.all([params, getReferenceData().catch(() => null)]);
  if (!refs) return <p role="alert">Experience details are unavailable right now.</p>;
  const result = await getPublicExperiences({ when: '', area: '', budget: '', vibe: '', group: '', category: '' }, refs, slug);
  if (result.error) return <p role="alert">Experience details are unavailable right now.</p>;
  const item = result.items[0];
  if (!item) notFound();
  const user = await getAuthenticatedUser().catch(() => null);
  const ids = user ? await myFavoriteIds().catch(() => []) : [];
  return <article><p>{item.category} · {item.area}</p><h1>{item.title}</h1><p>{item.venue}</p><p>{item.description}</p><p>From Rs {item.price.toLocaleString('en-PK')}</p><FavoriteButton id={item.id} saved={ids.includes(item.id)} signedIn={!!user} destination={`/discover/${item.slug}`} /></article>;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading experience…</p>}><Content {...props} /></Suspense>; }
