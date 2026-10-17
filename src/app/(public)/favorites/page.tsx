import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Alert, Typography } from '@mui/material';
import Link from '@/components/common/Link';
import { AppShell } from '@/components/shell/AppShell';
import { AuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { myFavoriteIds, publicExperiences } from '@/features/plans/data';
import { FavoriteButton } from '@/features/plans/components/FavoriteButton';
import { PlansStack } from '@/features/plans/components/PlansStack';

export const metadata = { title: 'Saved experiences' };
async function Content() {
  await requireAuthenticatedUser().catch((error: unknown) => { if (error instanceof AuthenticationRequiredError) redirect(loginPath('/favorites')); throw error; });
  const experiences = await myFavoriteIds().then(publicExperiences).catch(() => null);
  if (!experiences) return <Alert severity="error" role="alert">Saved experiences are unavailable right now.</Alert>;
  return <PlansStack><Typography variant="h4" component="h1">Saved experiences</Typography>
      {!experiences.length && <Alert severity="info">No published saved experiences yet. Explore Karachi to save one.</Alert>}
      {experiences.map(item => <article key={item.id}><Typography variant="h6" component="h2"><Link href={`/discover/${item.slug}`}>{item.title}</Link></Typography><FavoriteButton id={item.id} saved signedIn destination="/favorites" /></article>)}
    </PlansStack>;
}
export default function Page() { return <Suspense fallback={<p role="status">Loading saved experiences…</p>}><AppShell signedIn><Content /></AppShell></Suspense>; }
