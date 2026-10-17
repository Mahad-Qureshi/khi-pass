import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Alert, Typography } from '@mui/material';
import Link from '@/components/common/Link';
import { sharedPlan } from '@/features/plans/data';
import { JoinPlan, VoteButtons } from '@/features/plans/components/VotingControls';
import { PlansStack } from '@/features/plans/components/PlansStack';

export const metadata = { robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };
async function Content({ params }: Props) {
  const { token } = await params;
  const plan = await sharedPlan(token).catch(() => undefined);
  if (plan === undefined) return <Alert severity="error" role="alert">Shared plan is unavailable right now.</Alert>;
  if (!plan) notFound();
  const joined = !!(await cookies()).get(`khi_plan_${token}`)?.value;
  return <PlansStack><Typography variant="h4" component="h1">{plan.title}</Typography>
      {plan.startsAt && <Typography>Outing: {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium' }).format(new Date(plan.startsAt))}</Typography>}
      {plan.status === 'shared' && !joined && <JoinPlan shareId={token} />}
      {plan.status === 'closed' && <Alert severity="info">Voting is closed.</Alert>}
      {!plan.items.length && <Alert severity="info">No published experiences are available in this plan.</Alert>}
      {plan.items.map(item => <article key={item.id}><Typography variant="h6" component="h2"><Link href={`/discover/${item.experience.slug}`}>{item.experience.title}</Link></Typography>
        <Typography>Yes {item.yes} · Maybe {item.maybe} · No {item.no}</Typography>
        {plan.status === 'shared' && joined && <VoteButtons shareId={token} itemId={item.id} />}
      </article>)}
    </PlansStack>;
}
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading shared plan…</p>}><Content {...props} /></Suspense>; }
