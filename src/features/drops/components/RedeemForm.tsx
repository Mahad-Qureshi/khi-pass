'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { redeemPass } from '../actions';

const schema = z.object({ code: z.string().trim().regex(/^KHI-[A-F0-9]{32}$/i, 'Enter a valid KHI PASS code.') });
type Values = z.infer<typeof schema>;
const Form = styled('form')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2), maxWidth: 560 }));

export function RedeemForm() {
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } });
  async function submit(values: Values) {
    setMessage(''); setSuccess(false);
    try {
      const result = await redeemPass(values);
      if ('error' in result) { setMessage(result.error); return; }
      setSuccess(true); setMessage('PASS redeemed successfully.'); reset();
    } catch { setMessage('Redemption is unavailable. Please try again.'); }
  }
  return <Form noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
    <Typography variant="h4" component="h1">Redeem a PASS</Typography>
    <Typography>Enter the customer’s KHI PASS code. Redemption is final and can happen only once.</Typography>
    {message && <Alert severity={success ? 'success' : 'error'} role="alert">{message}</Alert>}
    <TextField label="Redemption code" autoComplete="off" required disabled={isSubmitting}
      {...register('code')} error={!!errors.code} helperText={errors.code?.message} />
    <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Redeeming…' : 'Redeem PASS'}</Button>
  </Form>;
}
