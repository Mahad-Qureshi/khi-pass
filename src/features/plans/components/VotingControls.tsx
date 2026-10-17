'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { joinInput } from '../schema';
import { joinPlan, voteOnPlan } from '../actions';

const Form = styled('form')(({ theme }) => ({ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: theme.spacing(1.5) }));
export function JoinPlan({ shareId }: { shareId: string }) {
  const router = useRouter(); const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(joinInput), defaultValues: { shareId, nickname: '' } });
  return <Form onSubmit={handleSubmit(async values => {
    setError('');
    try {
      const result = await joinPlan(values);
      if ('error' in result) setError(result.error); else router.refresh();
    } catch { setError('Unable to join plan. Try again.'); }
  })} noValidate><TextField label="Your nickname" {...register('nickname')} error={!!errors.nickname} helperText={errors.nickname?.message} disabled={isSubmitting} />
    <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Joining…' : 'Join to vote'}</Button>
    {error && <Alert severity="error" role="alert">{error}</Alert>}</Form>;
}

export function VoteButtons({ shareId, itemId }: { shareId: string; itemId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function vote(choice: 'yes' | 'maybe' | 'no') {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const result = await voteOnPlan({ shareId, itemId, vote: choice });
      if ('error' in result) setMessage(result.error); else { setMessage('Vote saved.'); router.refresh(); }
    } catch { setMessage('Unable to save vote. Try again.'); }
    finally { setBusy(false); }
  }
  return <div role="group" aria-label="Vote on experience"><Button disabled={busy} onClick={() => void vote('yes')}>Yes</Button><Button disabled={busy} onClick={() => void vote('maybe')}>Maybe</Button><Button disabled={busy} onClick={() => void vote('no')}>No</Button>{message && <span role="status">{message}</span>}</div>;
}
