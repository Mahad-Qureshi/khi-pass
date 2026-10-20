import { Suspense } from 'react';
import Link from 'next/link';
import { Alert, Card, CardContent, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/shell/AppShell';
import { getMerchantMemberships } from '@/features/merchant/data';

export const metadata = { title: 'Merchant businesses' };

async function Businesses() {
  const memberships = await getMerchantMemberships();
  return <Stack spacing={2} sx={{ py: 3 }}>
    <Typography variant="h4" component="h1">Merchant businesses</Typography>
    {!memberships.length && <Alert severity="info">No merchant membership assigned. Contact KHI PASS administration to onboard your business.</Alert>}
    {memberships.map(m => <Card variant="outlined" key={m.id}><Link href={`/merchant/${m.id}`}
      style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
      <CardContent><Typography variant="h6">{m.name}</Typography>
        <Typography color="text.secondary">{m.role} · {m.status}</Typography>
      </CardContent>
    </Link></Card>)}
  </Stack>;
}

export default function MerchantPage() {
  return <Suspense fallback={<p role="status">Loading merchant businesses…</p>}>
    <AppShell signedIn><Businesses /></AppShell>
  </Suspense>;
}
