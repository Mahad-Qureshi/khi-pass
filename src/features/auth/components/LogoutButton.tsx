'use client';

import { useState, useTransition } from 'react';
import { Alert, Button } from '@mui/material';
import { logout } from '../actions';

export function LogoutButton() {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState('');
    return <>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="outlined" disabled={pending} onClick={() => startTransition(async () => {
            setError('');
            try { const result = await logout(); if (result) setError(result.error); }
            catch { setError('Unable to sign out. Please try again.'); }
        })}>{pending ? 'Signing out…' : 'Sign out'}</Button>
    </>;
}
