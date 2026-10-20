'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Box, Button, Chip, MenuItem, Paper, Select, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { deleteMerchantContent, setMerchantContentStatus } from '../actions';
import type { MerchantMembership } from '../data';
import type { MerchantKind } from '../schema';

export const MerchantStatsGrid = styled('div')(({ theme }) => ({
  display: 'grid', gap: theme.spacing(2), gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
}));
const Panel = styled('section')(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: theme.spacing(2),
  marginBlock: theme.spacing(3), minWidth: 0,
}));
const Navigation = styled('nav')(({ theme }) => ({
  display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1),
  '& a': { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: theme.spacing(1, 1.5),
    color: theme.palette.primary.main, border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius, textDecoration: 'none' },
  '& a:focus-visible': { outline: `3px solid ${theme.palette.secondary.main}`, outlineOffset: 2 },
}));
const ContentRow = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2), display: 'flex', gap: theme.spacing(1), flexDirection: 'column',
  justifyContent: 'space-between', minWidth: 0,
  [theme.breakpoints.up('sm')]: { flexDirection: 'row', alignItems: 'center' },
}));
const Actions = styled('div')(({ theme }) => ({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) }));

export function MerchantWorkspace({ membership, memberships, children }: {
  membership: MerchantMembership; memberships: MerchantMembership[]; children: React.ReactNode;
}) {
  const router = useRouter();
  const base = `/merchant/${membership.id}`;
  return <Panel>
    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Typography variant="h4" component="h1">{membership.name}</Typography>
      <Typography color="text.secondary">Merchant workspace · {membership.role} · {membership.status}</Typography>
      {membership.status === 'suspended' && <Alert severity="warning">Business suspended. Content changes and redemption unavailable.</Alert>}
    </Box>
    <Select value={membership.id} size="small" aria-label="Select business" sx={{ minWidth: 0, width: '100%' }} onChange={e => router.push(`/merchant/${e.target.value}`)}>
      {memberships.map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
    </Select>
    <Navigation aria-label="Merchant navigation">
      <Link href={base}>Overview</Link><Link href={`${base}/venues`}>Venues</Link>
      <Link href={`${base}/experiences`}>Experiences</Link><Link href={`${base}/drops`}>PASS Drops</Link>
      <Link href="/merchant/redeem">Redeem PASS</Link><Link href="/merchant">All businesses</Link>
    </Navigation>
    {children}
  </Panel>;
}

export function MerchantListing({ merchantId, kind, editable, items, page, total }: {
  merchantId: string; kind: MerchantKind; editable: boolean;
  items: { id: string; title: string; status: string; updatedAt: string }[];
  page: number; total: number;
}) {
  const path = `/merchant/${merchantId}/${kind}`;
  const pages = Math.ceil(total / 20);
  return <Panel>
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Typography variant="h5" component="h2">{kind === 'drops' ? 'PASS Drops' : kind === 'venues' ? 'Venues' : 'Experiences'} ({total})</Typography>
      {editable && <Button component={Link} href={`${path}/new`} variant="contained">Create {kind === 'drops' ? 'PASS Drop' : kind === 'venues' ? 'venue' : 'experience'}</Button>}
    </Box>
    {items.length === 0 && <Alert severity="info">No records on this page.</Alert>}
    {items.map(row => <ContentRow key={row.id} variant="outlined">
      <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{row.title}</Typography>
        <Typography variant="body2" color="text.secondary">Updated {new Date(row.updatedAt).toLocaleDateString('en-PK')}</Typography>
      </Box>
      <Actions><Chip size="small" label={row.status.replaceAll('_', ' ')} />
        {editable && <Button size="small" component={Link} href={`${path}/${row.id}`}>Edit</Button>}
      </Actions>
    </ContentRow>)}
    {pages > 1 && <Navigation aria-label="List pagination">
      {page > 1 && <Link href={`${path}?page=${page - 1}`}>Previous page</Link>}
      <Typography sx={{ alignSelf: 'center' }}>Page {page} of {pages}</Typography>
      {page < pages && <Link href={`${path}?page=${page + 1}`}>Next page</Link>}
    </Navigation>}
  </Panel>;
}

export function MerchantContentActions({ merchantId, kind, id, status }: {
  merchantId: string; kind: MerchantKind; id: string; status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const options: { status: 'draft' | 'pending_approval' | 'archived' | 'paused'; label: string }[] = kind === 'drops'
    ? [{ status: 'draft', label: 'Move to draft' }, { status: 'pending_approval', label: 'Submit for approval' }, { status: 'paused', label: 'Pause' }]
    : [{ status: 'draft', label: 'Move to draft' }, { status: 'pending_approval', label: 'Submit for approval' }, { status: 'archived', label: 'Archive' }];
  async function change(next: (typeof options)[number]['status']) {
    setPending(true); setMessage('');
    try {
      const result = await setMerchantContentStatus({ merchantId, kind, id, status: next });
      if ('error' in result) setMessage(result.error);
      else router.refresh();
    } catch { setMessage('Status change failed.'); }
    finally { setPending(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setPending(true); setMessage('');
    try {
      const result = await deleteMerchantContent({ merchantId, kind, id });
      if ('error' in result) setMessage(result.error);
      else { router.push(`/merchant/${merchantId}/${kind}`); router.refresh(); }
    } catch { setMessage('Delete failed.'); }
    finally { setPending(false); }
  }
  return <Panel>
    <Typography variant="h6" component="h2">Moderation and status</Typography>
    <Chip label={`Current status: ${status.replaceAll('_', ' ')}`} sx={{ justifySelf: 'start' }} />
    <Actions>
      {options.filter(x => x.status !== status).map(x => <Button key={x.status} variant="outlined" disabled={pending} onClick={() => change(x.status)}>{x.label}</Button>)}
      {['draft', 'rejected'].includes(status) && <Button color="error" disabled={pending} onClick={remove}>Delete draft</Button>}
    </Actions>
    {message && <Alert severity="error" role="alert">{message}</Alert>}
  </Panel>;
}
