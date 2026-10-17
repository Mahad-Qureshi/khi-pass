import { Suspense } from 'react';
import { getReferenceData } from '@/features/discovery/reference-data';
import { getPublicExperiences } from '@/features/discovery/data';
import { normalizeFilters, type RawSearchParams } from '@/features/discovery/filters';
import { DiscoveryFilters } from '@/features/discovery/components/DiscoveryFilters';
import { ExperienceCard } from '@/features/discovery/components/ExperienceCard';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { myFavoriteIds } from '@/features/plans/data';

export const metadata = { title: 'Discover' };
type Props = { searchParams: Promise<RawSearchParams> };

async function DiscoverContent({ searchParams }: Props) {
  const [raw, refs] = await Promise.all([searchParams, getReferenceData().catch(() => null)]);
  if (!refs) return <section aria-labelledby="discover-title"><h1 id="discover-title">Discover Karachi</h1><p role="alert">Discovery is unavailable right now. Please try again later.</p></section>;
  const filters = normalizeFilters(raw, refs);
  const result = await getPublicExperiences(filters, refs);
  const user = await getAuthenticatedUser().catch(() => null);
  const favoriteIds = user ? await myFavoriteIds().catch(() => []) : [];
  return <>
    <section aria-labelledby="discover-title"><h1 id="discover-title">Discover Karachi</h1><p>Find published experiences that match your plans.</p><DiscoveryFilters refs={refs} /></section>
    <div role="region" aria-label="Discovery results" aria-live="polite">
      {result.error ? <p role="alert">Experiences are unavailable right now. Please try again later.</p> :
        <><p>{result.items.length} {result.items.length === 1 ? 'experience' : 'experiences'} found</p>
        <DiscoverySection title="Experiences" empty="No published experiences match these filters. Try another area, time or budget.">
          {result.items.length ? result.items.map((experience) => <ExperienceCard key={experience.id} experience={experience} signedIn={!!user} saved={favoriteIds.includes(experience.id)} />) : null}
        </DiscoverySection></>}
    </div>
  </>;
}

export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Loading experiences…</p>}><DiscoverContent {...props} /></Suspense>;
}
