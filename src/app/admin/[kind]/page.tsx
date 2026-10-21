import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { AdminRow, MerchantCreateForm, UserLookup } from '@/features/admin/components/AdminUI';
import { adminList, adminUserOptions } from '@/features/admin/data';

const kinds = { merchants: 'merchant', venues: 'venue', experiences: 'experience', drops: 'drop' } as const;
type Props = { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; status?: string; page?: string; user?: string }> };

async function AdminList({ params, searchParams }: Props) {
  const { kind: segment } = await params;
  const kind = kinds[segment as keyof typeof kinds];
  if (!kind) notFound();
  const search = await searchParams;
  const q = (search.q ?? '').trim().slice(0, 100);
  const status = (search.status ?? '').trim().slice(0, 32);
  const userSearch = (search.user ?? '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(1000, Number.parseInt(search.page ?? '1', 10) || 1));
  const [list, users] = await Promise.all([adminList(kind, q, status, page), kind === 'merchant' ? adminUserOptions(userSearch) : Promise.resolve([])]);
  const url = (next: number) => `/admin/${segment}?${new URLSearchParams({ q, status, page: String(next) })}`;
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5">{segment === 'drops' ? 'PASS Drops' : segment} ({list.total})</Typography>
    {kind === 'merchant' && <><UserLookup value={userSearch} /><MerchantCreateForm users={users} /></>}
    <Stack component="form" method="get" direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField name="q" label="Search by name" size="small" defaultValue={q} />
      <TextField name="status" label="Status" size="small" defaultValue={status} />
      <Button type="submit" variant="outlined">Filter</Button>
    </Stack>
    {!list.items.length && <Alert severity="info">No records match this view.</Alert>}
    {list.items.map(item => <AdminRow key={item.id} href={`/admin/${segment}/${item.id}`} title={item.title}
      status={item.status} subtitle={kind === 'merchant' ? undefined : `Merchant ${item.merchantId}`} />)}
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {page > 1 && <Link href={url(page - 1)}>Previous</Link>}
      <Typography>Page {page} of {Math.max(1, Math.ceil(list.total / 20))}</Typography>
      {page * 20 < list.total && <Link href={url(page + 1)}>Next</Link>}
    </Stack>
  </Stack>;
}

export default function AdminListPage(props: Props) {
  return <Suspense fallback={<Alert role="status">Loading records…</Alert>}><AdminList {...props} /></Suspense>;
}
