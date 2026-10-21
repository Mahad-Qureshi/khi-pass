import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Alert, Card, CardContent, Stack, Typography } from '@mui/material';
import { MemberForm, ModerationControl, UserLookup } from '@/features/admin/components/AdminUI';
import { adminDetail, adminUserOptions } from '@/features/admin/data';

const kinds = { merchants: 'merchant', venues: 'venue', experiences: 'experience', drops: 'drop' } as const;
type Props = { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ user?: string }> };

async function AdminDetail({ params, searchParams }: Props) {
  const { kind: segment, id } = await params;
  const kind = kinds[segment as keyof typeof kinds];
  if (!kind) notFound();
  const userSearch = ((await searchParams).user ?? '').trim().slice(0, 100);
  const [detail, users] = await Promise.all([adminDetail(kind, id), kind === 'merchant' ? adminUserOptions(userSearch) : Promise.resolve([])]);
  const record = detail.record;
  const title = 'business_name' in record ? record.business_name : 'name' in record ? record.name : record.title;
  const fields = kind === 'merchant' ? ['slug', 'business_type', 'description'] : kind === 'venue'
    ? ['slug', 'address', 'phone', 'area_id'] : kind === 'experience'
      ? ['slug', 'description', 'venue_id', 'min_price', 'max_price']
      : ['slug', 'description', 'terms', 'starts_at', 'ends_at', 'claim_limit', 'per_user_limit', 'venue_id'];
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5">{title}</Typography>
    <Alert severity="info">Current status: {record.status.replaceAll('_', ' ')}</Alert>
    <Card variant="outlined"><CardContent><Stack spacing={1}>
      {fields.map(field => <Typography key={field} sx={{ overflowWrap: 'anywhere' }}>
        <strong>{field.replaceAll('_', ' ')}:</strong> {String(record[field as keyof typeof record] ?? '—')}
      </Typography>)}
    </Stack></CardContent></Card>
    <ModerationControl kind={kind} id={id} status={record.status} />
    {kind === 'merchant' && <>
      <Typography component="h3" variant="h6">Memberships</Typography>
      {!detail.members.length && <Alert severity="warning">No members assigned.</Alert>}
      {detail.members.map(member => <Card variant="outlined" key={member.user_id}><CardContent>
        <Typography>{member.user_id} · {member.role}</Typography>
      </CardContent></Card>)}
      <UserLookup value={userSearch} /><MemberForm merchantId={id} users={users} />
    </>}
  </Stack>;
}

export default function AdminDetailPage(props: Props) {
  return <Suspense fallback={<Alert role="status">Loading details…</Alert>}><AdminDetail {...props} /></Suspense>;
}
