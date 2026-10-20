import { Suspense } from 'react';
import { Alert, Card, CardContent, Typography } from '@mui/material';
import { MerchantStatsGrid } from '@/features/merchant/components/MerchantWorkspace';
import { merchantOverview, requireMerchant } from '@/features/merchant/data';

export const metadata = { title: 'Merchant overview' };


async function OverviewContent({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const member = await requireMerchant(merchantId);
  const stats = await merchantOverview(merchantId).catch(() => null);
  if (!stats) return <Alert severity="error" role="alert">Analytics unavailable. Please retry.</Alert>;
  const measures = [
    ['Venues', stats.venues], ['Experiences', stats.experiences], ['PASS Drops', stats.drops],
    ['Claims issued (30d)', stats.issued], ['Redeemed (30d)', stats.redeemed],
    ['Pending (30d)', stats.pending], ['Expired (30d)', stats.expired], ['Cancelled (30d)', stats.cancelled],
  ] as const;
  return <section aria-label="Merchant analytics">
    <Typography variant="h5" component="h2" gutterBottom>Overview</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Your {member.name} inventory and activity. Claim metrics cover previous 30 days, by claim date.</Typography>
    <MerchantStatsGrid>{measures.map(([label, value]) => <Card variant="outlined" key={label}>
      <CardContent><Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography component="p" variant="h4" sx={{ fontWeight: 700 }}>{value.toLocaleString('en-PK')}</Typography>
      </CardContent>
    </Card>)}</MerchantStatsGrid>
  </section>;
}

export default function MerchantOverview({ params }: { params: Promise<{ merchantId: string }> }) {
  return <Suspense fallback={<p role="status">Loading merchant overview…</p>}>
    <OverviewContent params={params} />
  </Suspense>;
}
