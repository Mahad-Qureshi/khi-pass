'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { assignMember, createMerchant, moderate } from '../actions';
import { memberInput, merchantInput, transitions } from '../schema';
import type { z } from 'zod';

export const AdminGrid = styled('div')(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: 'repeat(2,minmax(0,1fr))' },
  [theme.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' },
}));
export const AdminNav = styled('nav')(({ theme }) => ({
  display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1), marginBlock: theme.spacing(2),
  '& a': { padding: theme.spacing(1, 1.5), minHeight: 44, display: 'inline-flex', alignItems: 'center',
    color: theme.palette.primary.main, border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius, textDecoration: 'none' },
}));

export function UserLookup({ value }: { value: string }) {
  return <Stack component="form" method="get" direction={{ xs: 'column', sm: 'row' }} spacing={1}>
    <TextField name="user" label="Find registered user by name or ID" size="small" defaultValue={value} />
    <Button type="submit" variant="outlined">Find user</Button>
  </Stack>;
}

type UserOption = { id: string; display_name: string | null };

export function MerchantCreateForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<z.infer<typeof merchantInput> | null>(null);
  const [creating, setCreating] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof merchantInput>>({
    resolver: zodResolver(merchantInput), defaultValues: { businessName: '', slug: '', businessType: '', ownerId: '' },
  });
  return <Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={handleSubmit(value => {
    setMessage(''); setConfirmation(value);
  })}>
    <Typography variant="h6">Create merchant</Typography>
    <TextField label="Business name" {...register('businessName')} error={!!errors.businessName} helperText={errors.businessName?.message} />
    <TextField label="Slug" {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
    <TextField label="Business type" {...register('businessType')} error={!!errors.businessType} helperText={errors.businessType?.message} />
    <TextField select label="Registered owner" defaultValue="" {...register('ownerId')} error={!!errors.ownerId} helperText={errors.ownerId?.message}>
      {users.map(user => <MenuItem value={user.id} key={user.id}>{user.display_name || 'Unnamed user'} ({user.id})</MenuItem>)}
    </TextField>
    {!users.length && <Alert severity="info">No registered users are available. A user must sign up first.</Alert>}
    {message && <Alert severity="error">{message}</Alert>}
    <Button type="submit" variant="contained" disabled={isSubmitting || creating || !users.length}>Create merchant</Button>
  </Stack></CardContent>
    <Dialog open={confirmation !== null} onClose={() => !creating && setConfirmation(null)} fullWidth>
      <DialogTitle>Confirm merchant owner</DialogTitle>
      <DialogContent><Typography sx={{ pt: 1, overflowWrap: 'anywhere' }}>
        Create {confirmation?.businessName} and assign the owner role to {confirmation?.ownerId}?
      </Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmation(null)} disabled={creating}>Cancel</Button>
        <Button disabled={creating} onClick={async () => {
          if (!confirmation) return;
          setCreating(true); setMessage('');
          try {
            const result = await createMerchant(confirmation);
            if ('error' in result) setMessage(result.error);
            else { router.push(`/admin/merchants/${result.id}`); router.refresh(); }
          } catch { setMessage('Unable to create merchant. Try again.'); }
          finally { setCreating(false); setConfirmation(null); }
        }}>Confirm creation</Button></DialogActions>
    </Dialog>
  </Card>;
}

export function MemberForm({ merchantId, users }: { merchantId: string; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof memberInput>>({
    resolver: zodResolver(memberInput), defaultValues: { merchantId, userId: '', role: 'staff' },
  });
  return <Card variant="outlined"><CardContent><Stack component="form" spacing={2} onSubmit={handleSubmit(async value => {
    try {
      const result = await assignMember(value); setMessage('error' in result ? result.error : 'Membership assigned.');
      if ('ok' in result) router.refresh();
    } catch { setMessage('Unable to assign member. Try again.'); }
  })}>
    <Typography variant="h6">Assign member</Typography>
    <TextField select label="Registered user" defaultValue="" {...register('userId')} error={!!errors.userId} helperText={errors.userId?.message}>
      {users.map(user => <MenuItem value={user.id} key={user.id}>{user.display_name || 'Unnamed user'} ({user.id})</MenuItem>)}
    </TextField>
    <TextField select label="Role" defaultValue="staff" {...register('role')} error={!!errors.role}>
      {['owner', 'manager', 'staff'].map(role => <MenuItem value={role} key={role}>{role}</MenuItem>)}
    </TextField>
    {message && <Alert severity={message === 'Membership assigned.' ? 'success' : 'error'}>{message}</Alert>}
    <Button type="submit" disabled={isSubmitting || !users.length}>Assign member</Button>
  </Stack></CardContent></Card>;
}

export function ModerationControl({ kind, id, status }: { kind: keyof typeof transitions; id: string; status: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {(transitions[kind][status] ?? []).map(next => <Button key={next} variant="outlined" onClick={() => setTarget(next)}>{next.replaceAll('_', ' ')}</Button>)}
    </Stack>
    {message && <Alert severity="error">{message}</Alert>}
    <Dialog open={target !== null} onClose={() => !pending && setTarget(null)} fullWidth>
      <DialogTitle>Confirm status change</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography>Change this {kind} from {status.replaceAll('_', ' ')} to {target?.replaceAll('_', ' ')}?</Typography>
        <TextField label="Reason (optional)" multiline minRows={2} value={reason} onChange={event => setReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setTarget(null)} disabled={pending}>Cancel</Button>
        <Button disabled={pending} onClick={async () => {
          if (!target) return;
          setPending(true); setMessage('');
          try { const result = await moderate({ kind, id, status: target, reason });
            if ('error' in result) setMessage(result.error);
            else router.refresh();
          } catch { setMessage('Unable to change status.'); }
          finally { setPending(false); setTarget(null); setReason(''); }
        }}>Confirm</Button></DialogActions>
    </Dialog>
  </Stack>;
}

export function AdminRow({ href, title, status, subtitle }: { href: string; title: string; status: string; subtitle?: string }) {
  return <Card variant="outlined"><CardContent><Stack spacing={1}>
    <Typography component="h2" variant="h6"><Link href={href}>{title}</Link></Typography>
    <Typography color="text.secondary">{status.replaceAll('_', ' ')}{subtitle ? ` · ${subtitle}` : ''}</Typography>
  </Stack></CardContent></Card>;
}
