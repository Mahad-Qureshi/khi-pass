'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import Image from 'next/image';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import type { Pass } from '../pass-schema';

const Stack = styled('div')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2), maxWidth: 760 }));
const Code = styled('code')(({ theme }) => ({ display: 'block', overflowWrap: 'anywhere', fontSize: '1.2rem', fontWeight: 700, padding: theme.spacing(2), background: theme.palette.action.hover, borderRadius: theme.shape.borderRadius }));
const format = (value: string) => new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' PKT';
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
const state = (item: Pass, now: number) => item.status === 'pending' && now > 0 && Date.parse(item.expires_at) <= now ? 'expired' : item.status;

export function PassListView({ items, total, page }: { items: Pass[]; total: number; page: number }) {
  const now = useNow();
  return <Stack>
    <Typography variant="h4" component="h1">My PASSes</Typography>
    {!items.length && <Alert severity="info">You have no PASSes on this page.</Alert>}
    {items.map(item => <Card key={item.id} variant="outlined"><CardContent>
      <Typography variant="h6" component="h2">{item.title ?? 'PASS Drop'}</Typography>
      <Typography>{item.merchant_name ?? 'Merchant'}{item.venue_name ? ` · ${item.venue_name}` : ''}</Typography>
      <Chip label={state(item, now)} size="small" sx={{ my: 1 }} />
      <Typography>Claimed for Rs {item.price.toLocaleString('en-PK')} · Expires {format(item.expires_at)}</Typography>
      <Button component={Link} href={`/passes/${item.id}`}>View PASS</Button>
    </CardContent></Card>)}
    <div>
      {page > 0 && <Button component={Link} href={`/passes?page=${page - 1}`}>Previous</Button>}
      {(page + 1) * 20 < total && <Button component={Link} href={`/passes?page=${page + 1}`}>Next</Button>}
    </div>
  </Stack>;
}

export function PassDetailView({ item, qrDataUrl }: { item: Pass; qrDataUrl: string | null }) {
  const now = useNow();
  const status = state(item, now);
  return <Stack>
    <Typography variant="h4" component="h1">{item.title ?? 'PASS Drop'}</Typography>
    <Chip label={status} color={status === 'pending' ? 'success' : 'default'} sx={{ justifySelf: 'start' }} />
    <Typography>{item.merchant_name ?? 'Merchant'}{item.venue_name ? ` · ${item.venue_name}` : ''}</Typography>
    <Typography>Claimed for Rs {item.price.toLocaleString('en-PK')}</Typography>
    <Typography>Expires {format(item.expires_at)}</Typography>
    {status === 'pending' && item.redemption_code ? <>
      <Alert severity="info">Show this code to staff at the listed merchant before it expires. Each PASS can be redeemed once.</Alert>
      <Code>{item.redemption_code}</Code>
      {qrDataUrl && <Image src={qrDataUrl} alt="QR code containing only the redemption code" width={220} height={220} unoptimized />}
    </> : <Alert severity="info">{status === 'redeemed' ? 'This PASS has been redeemed.' : 'This PASS can no longer be redeemed.'}</Alert>}
    <Typography variant="body2">Terms: {item.terms}</Typography>
    <Button component={Link} href="/passes">Back to My PASSes</Button>
  </Stack>;
}
