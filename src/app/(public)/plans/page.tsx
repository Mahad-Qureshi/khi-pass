import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Alert, Typography } from '@mui/material';
import Link from '@/components/common/Link';
import { AppShell } from '@/components/shell/AppShell';
import { AuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { myPlans } from '@/features/plans/data';
import { PlanForm } from '@/features/plans/components/PlanControls';
import { PlansStack } from '@/features/plans/components/PlansStack';

export const metadata = { title: 'Outing plans' };
async function Content() {
  await requireAuthenticatedUser().catch((error: unknown) => { if (error instanceof AuthenticationRequiredError) redirect(loginPath('/plans')); throw error; });
  const plans = await myPlans().catch(() => null);
  if (!plans) return <Alert severity="error" role="alert">Plans are unavailable right now.</Alert>;
  return <PlansStack><Typography variant="h4" component="h1">Outing plans</Typography><PlanForm />
      <Typography variant="h5" component="h2">Your plans</Typography>
      {!plans.length && <Alert severity="info">No plans yet. Create one to start choosing experiences.</Alert>}
      {plans.map(plan => <article key={plan.id}><Link href={`/plans/${plan.id}`}>{plan.title}</Link> · {plan.status}</article>)}
    </PlansStack>;
}
export default function Page() { return <Suspense fallback={<p role="status">Loading plans…</p>}><AppShell signedIn><Content /></AppShell></Suspense>; }
