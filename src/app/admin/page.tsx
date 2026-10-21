import Link from 'next/link';
import { Alert, Card, CardContent, Typography } from '@mui/material';
import { AdminGrid } from '@/features/admin/components/AdminUI';
import { adminOverview } from '@/features/admin/data';

async function AdminOverview() {
  const counts = await adminOverview();
  return <><Typography variant="h5" component="h2">Overview</Typography>
    <AdminGrid>{counts.map(({ table, total, pending }) => <Card variant="outlined" key={table}>
      <CardContent><Typography variant="h6"><Link href={`/admin/${table}`}>{table === 'drops' ? 'PASS Drops' : table}</Link></Typography>
        <Typography>{total} total</Typography><Typography>{pending} pending approval</Typography>
      </CardContent></Card>)}</AdminGrid>
    {counts.every(x => x.total === 0) && <Alert severity="info">No merchants or content yet. Create a merchant to begin onboarding.</Alert>}
  </>;
}
import { Suspense } from 'react';

export default function AdminOverviewPage() {
  return <Suspense fallback={<Alert role="status">Loading overview…</Alert>}><AdminOverview /></Suspense>;
}
