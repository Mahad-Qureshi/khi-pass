'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Divider, Link as MuiLink, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import Link from '@/components/common/Link';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { authenticate } from '../actions';
import { loginSchema, signUpSchema, type AuthValues } from '../schemas/auth';
import { safeNext } from '../redirect';

const Form = styled('form')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2) }));
const Footer = styled(Typography)(({ theme }) => ({ marginTop: theme.spacing(3), textAlign: 'center' }));

export function AuthForm({ mode, next, callbackError = false }: { mode: 'login' | 'sign-up'; next: string; callbackError?: boolean }) {
    const [error, setError] = useState(callbackError ? 'The sign-in link could not be completed. Please try again.' : '');
    const [oauthPending, setOauthPending] = useState(false);
    const signup = mode === 'sign-up';
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthValues>({
        resolver: zodResolver(signup ? signUpSchema : loginSchema),
        defaultValues: { email: '', password: '', displayName: '', confirmPassword: '' },
    });
    const pending = isSubmitting || oauthPending;
    const destination = safeNext(next);
    async function submit(values: AuthValues) {
        setError('');
        try {
            const result = await authenticate(mode, values, destination);
            if ('error' in result) { setError(result.error); return; }
            // Full navigation avoids stale prefetched auth-dependent RSC payloads.
            window.location.assign(result.destination);
        } catch { setError('Unable to complete authentication. Please try again.'); }
    }
    async function google() {
        setError(''); setOauthPending(true);
        try {
            const { url, publishableKey } = getSupabaseEnv();
            const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: publishableKey }, cache: 'no-store' });
            const settings = response.ok ? await response.json() : null;
            if (settings?.external?.google !== true) throw new Error('Provider unavailable');
            const callback = new URL('/auth/callback', window.location.origin);
            callback.searchParams.set('next', destination);
            const { data, error: oauthError } = await createClient().auth.signInWithOAuth({
                provider: 'google', options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
            });
            if (oauthError || !data.url) { setError('Google sign-in is unavailable. Please use email and password.'); setOauthPending(false); return; }
            window.location.assign(data.url);
        } catch { setError('Google sign-in is unavailable. Please try again.'); setOauthPending(false); }
    }
    return <>
        <Form noValidate onSubmit={handleSubmit(submit)} aria-busy={pending}>
            {error && <Alert severity="error">{error}</Alert>}
            {signup && <TextField label="Display name" autoComplete="nickname" required disabled={pending}
                {...register('displayName')} error={!!errors.displayName} helperText={errors.displayName?.message} />}
            <TextField label="Email address" type="email" autoComplete="email" required disabled={pending}
                {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
            <TextField label="Password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required disabled={pending}
                {...register('password')} error={!!errors.password} helperText={errors.password?.message ?? (signup ? 'At least 6 characters. Use a long, unique password.' : undefined)} />
            {signup && <TextField label="Confirm password" type="password" autoComplete="new-password" required disabled={pending}
                {...register('confirmPassword')} error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message} />}
            <Button variant="contained" type="submit" disabled={pending}>{isSubmitting ? 'Please waitâ€¦' : signup ? 'Create account' : 'Sign in'}</Button>
            <Divider>or</Divider>
            <Button variant="outlined" type="button" startIcon={<GoogleIcon />} disabled={pending} onClick={google}>
                {oauthPending ? 'Connectingâ€¦' : 'Continue with Google'}
            </Button>
        </Form>
        <Footer variant="body2">{signup ? 'Already have an account? ' : 'New to KHI PASS? '}
            <MuiLink component={Link} prefetch={false} href={(signup ? '/auth/login' : '/auth/sign-up') + '?next=' + encodeURIComponent(destination)}>
                {signup ? 'Sign in' : 'Create an account'}
            </MuiLink>
        </Footer>
    </>;
}
