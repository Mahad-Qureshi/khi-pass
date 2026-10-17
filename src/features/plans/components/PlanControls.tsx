'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, MenuItem, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { createPlan, deletePlan, rotateShareLink, setPlanItem, setPlanSharing, updatePlan } from '../actions';

const Form = styled('form')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2), maxWidth: 620 }));
const Row = styled('div')(({ theme }) => ({ display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap', alignItems: 'center' }));
const formSchema = z.object({ title: z.string().trim().min(1).max(200), date: z.string().refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00+05:00`)), 'Enter a valid date.') });
type Values = z.infer<typeof formSchema>;
export function PlanForm({ id, title = '', startsAt = null }: { id?: string; title?: string; startsAt?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: { title, date: startsAt ? startsAt.slice(0, 10) : '' } });
  async function submit(values: Values) {
    setMessage('');
    try {
      const startsAt = values.date ? new Date(`${values.date}T12:00:00+05:00`).toISOString() : null;
      const result = id ? await updatePlan({ id, title: values.title, startsAt }) : await createPlan({ title: values.title, startsAt });
      if ('error' in result) setMessage(result.error); else if (result.id) router.push(`/plans/${result.id}`); else { setMessage('Plan saved.'); router.refresh(); }
    } catch { setMessage('Unable to save plan. Try again.'); }
  }
  return <Form onSubmit={handleSubmit(submit)} noValidate>
    <Typography variant="h6" component="h2">{id ? 'Edit plan' : 'Create an outing plan'}</Typography>
    <TextField label="Plan title" required {...register('title')} error={!!errors.title} helperText={errors.title?.message} disabled={isSubmitting} />
    <TextField label="Outing date in Karachi" type="date" slotProps={{ inputLabel: { shrink: true } }} {...register('date')} disabled={isSubmitting} error={!!errors.date} helperText={errors.date?.message} />
    <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : id ? 'Save changes' : 'Create plan'}</Button>
    {message && <Alert severity={message === 'Plan saved.' ? 'success' : 'error'} role="alert">{message}</Alert>}
  </Form>;
}

export function PlanActions({ id, shared }: { id: string; shared: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function run(action: () => Promise<{ ok: true } | { error: string }>, deleted = false) {
    if (busy) return; setBusy(true); setError('');
    try {
      const result = await action();
      if ('error' in result) setError(result.error); else if (deleted) router.push('/plans'); else router.refresh();
    } catch { setError('Unable to change plan. Try again.'); }
    finally { setBusy(false); }
  }
  return <><Row>
    <Button onClick={() => run(() => setPlanSharing(id))} disabled={busy}>{shared ? 'Make private' : 'Share plan'}</Button>
    <Button onClick={() => run(() => rotateShareLink(id))} disabled={busy}>Replace share link</Button>
    <Button color="error" onClick={() => { if (window.confirm('Delete this plan and its votes?')) void run(() => deletePlan(id), true); }} disabled={busy}>Delete plan</Button>
  </Row>{error && <Alert severity="error" role="alert">{error}</Alert>}</>;
}

export function PlanItemsControl({ planId, options, selected }: { planId: string; options: { id: string; title: string }[]; selected: string[] }) {
  const router = useRouter(); const [choice, setChoice] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function change(experienceId: string, add: boolean) {
    if (busy) return; setBusy(true); setError('');
    try {
      const result = await setPlanItem({ planId, experienceId, add });
      if ('error' in result) setError(result.error); else { setChoice(''); router.refresh(); }
    } catch { setError('Unable to change plan items. Try again.'); }
    finally { setBusy(false); }
  }
  return <><Row><TextField select label="Add a published experience" value={choice} onChange={event => setChoice(event.target.value)} sx={{ minWidth: 260 }}>
    {options.filter(item => !selected.includes(item.id)).map(item => <MenuItem key={item.id} value={item.id}>{item.title}</MenuItem>)}
  </TextField><Button onClick={() => void change(choice, true)} disabled={!choice || busy}>Add</Button></Row>
    {selected.map(id => <Button key={id} onClick={() => void change(id, false)} disabled={busy} aria-label={`Remove ${options.find(item => item.id === id)?.title ?? 'experience'} from plan`}>Remove {options.find(item => item.id === id)?.title ?? 'experience'}</Button>)}
    {error && <Alert severity="error" role="alert">{error}</Alert>}</>;
}
