import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Alert, Typography } from '@mui/material';
import Link from '@/components/common/Link';
import { AppShell } from '@/components/shell/AppShell';
import { AuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { myPlan, publicExperienceOptions } from '@/features/plans/data';
import { PlanActions, PlanForm, PlanItemsControl } from '@/features/plans/components/PlanControls';
import { PlansStack } from '@/features/plans/components/PlansStack';

type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  await requireAuthenticatedUser().catch((error: unknown) => { if (error instanceof AuthenticationRequiredError) redirect(loginPath(`/plans/${id}`)); throw error; });
  const result = await myPlan(id).catch(() => undefined);
  if (result === undefined) return <Alert severity="error" role="alert">Plan details are unavailable right now.</Alert>;
  if (!result) notFound();
  const options = await publicExperienceOptions().catch(() => null);
  if (!options) return <Alert severity="error" role="alert">Plan details are unavailable right now.</Alert>;
  return <PlansStack><Typography variant="h4" component="h1">{result.plan.title}</Typography>
      <PlanForm id={id} title={result.plan.title} startsAt={result.plan.starts_at} />
      <Typography variant="h5" component="h2">Experiences</Typography>
      {!result.items.length && <Alert severity="info">No published experiences in this plan yet.</Alert>}
      {result.items.map(item => <article key={item.id}><Link href={`/discover/${item.experience.slug}`}>{item.experience.title}</Link> · From Rs {item.experience.min_price}</article>)}
      <PlanItemsControl planId={id} options={options} selected={result.items.map(item => item.experience_id)} />
      <Typography variant="h5" component="h2">Sharing</Typography>
      <PlanActions id={id} shared={result.plan.status === 'shared'} />
      {result.plan.status === 'shared' && <p>Share link: <Link href={`/plans/share/${result.plan.share_id}`}>{`/plans/share/${result.plan.share_id}`}</Link></p>}
      <Link href="/plans">Back to plans</Link>
    </PlansStack>;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading plan…</p>}><AppShell signedIn><Content {...props} /></AppShell></Suspense>; }
