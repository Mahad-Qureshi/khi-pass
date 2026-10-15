import { Suspense } from 'react';
import { getPublicDrops } from '@/features/drops/data';
import { DropCard } from '@/features/drops/components/DropCard';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';

export const metadata = { title: 'PASS Drops' };

async function DropList() {
  const result = await getPublicDrops();
  return <>
    <section aria-labelledby="drops-title"><h1 id="drops-title">PASS Drops</h1><p>Explore current fictional offers in Karachi.</p></section>
    {result.error ? <p role="alert">PASS Drops are unavailable right now.</p> :
      <DiscoverySection title="Current Drops" empty="No active PASS Drops are available right now.">
        {result.items.length ? result.items.map((drop) => <DropCard key={drop.id} drop={drop} />) : null}
      </DiscoverySection>}
  </>;
}

export default function Page() {
  return <Suspense fallback={<p role="status">Loading PASS Drops...</p>}><DropList /></Suspense>;
}
