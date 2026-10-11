import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getReferenceData } from '@/features/discovery/reference-data';
import { getPublicExperiences } from '@/features/discovery/data';
import { normalizeFilters, type RawSearchParams } from '@/features/discovery/filters';
import { DiscoveryFilters } from '@/features/discovery/components/DiscoveryFilters';
import { DiscoveryHero } from '@/features/discovery/components/DiscoveryHero';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';
import { ExperienceCard } from '@/features/discovery/components/ExperienceCard';
import { getPublicDrops } from '@/features/drops/data';
import { DropCard } from '@/features/drops/components/DropCard';

export const metadata: Metadata = { title: 'KHI PASS' };
type Props = { searchParams: Promise<RawSearchParams> };

async function HomeContent({ searchParams }: Props) {
  const [raw, refs, drops] = await Promise.all([searchParams, getReferenceData().catch(() => null), getPublicDrops()]);
  const blank = { when: '', area: '', budget: '', vibe: '', group: '', category: '' };
  const [all, weekend, groups] = refs ? await Promise.all([
    getPublicExperiences(blank, refs),
    getPublicExperiences({ ...blank, when: 'weekend' }, refs),
    getPublicExperiences({ ...blank, group: 'friends' }, refs),
  ]) : [{ items: [], error: true }, { items: [], error: true }, { items: [], error: true }];
  const current = refs ? normalizeFilters(raw, refs) : blank;
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const sections = [
    { title: 'Trending Tonight', items: [], message: 'Trending rankings are not available yet. Browse Discover for published experiences.' },
    { title: 'This Weekend', items: weekend.items.slice(0, 6), message: 'No published experiences match this weekend yet.' },
    { title: 'Under Rs 2,000', items: all.items.filter((item) => item.price <= 2000).slice(0, 6), message: 'No published experiences start under Rs 2,000 yet.' },
    { title: 'Near You', items: [], message: 'Nearby recommendations will appear when location search is available. Use the Area filter meanwhile.' },
    { title: 'For Groups', items: groups.items.slice(0, 6), message: 'No published experiences currently match a group of four.' },
    { title: 'Date Ideas', items: all.items.filter((item) => item.vibeSlugs.includes('date-night')).slice(0, 6), message: 'No published experiences have the Date Night vibe yet.' },
    { title: 'New in Karachi', items: all.items.filter((item) => Date.parse(item.createdAt) >= recentCutoff.getTime()).slice(0, 6), message: 'No experiences have been published recently.' },
  ];
  return <>
    <DiscoveryHero>
      {refs ? <DiscoveryFilters refs={refs} showCta /> : <p role="status">Discovery filters are unavailable right now. Please try again later.</p>}
      {Object.values(current).some(Boolean) && <p>Your filters are ready. Select Explore Karachi to view matching experiences.</p>}
    </DiscoveryHero>
    <DiscoverySection title="PASS Drops" empty={drops.error ? 'PASS Drops are unavailable right now.' : 'No active PASS Drops are available right now.'}>
      {drops.items.length ? drops.items.slice(0, 6).map((drop) => <DropCard key={drop.id} drop={drop} />) : null}
    </DiscoverySection>
    {sections.map(({ title, items, message }) => <DiscoverySection key={title} title={title} empty={all.error || weekend.error || groups.error ? 'Experiences are unavailable right now. Please try again later.' : message}>
      {items.length ? items.map((experience) => <ExperienceCard key={experience.id} experience={experience} />) : null}
    </DiscoverySection>)}
  </>;
}

export default function HomePage(props: Props) {
  return <Suspense fallback={<p role="status">Loading Karachi discovery…</p>}><HomeContent {...props} /></Suspense>;
}
