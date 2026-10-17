'use client';
import { useState } from 'react';
import { Button } from '@mui/material';
import { setFavorite } from '../actions';
import Link from '@/components/common/Link';
import { loginPath } from '@/features/auth/redirect';

export function FavoriteButton({ id, saved, signedIn, destination }: { id: string; saved: boolean; signedIn: boolean; destination: string }) {
  const [active, setActive] = useState(saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!signedIn) return <Button component={Link} href={loginPath(destination)} aria-label="Sign in to save experience">Save</Button>;
  async function toggle() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const result = await setFavorite({ experienceId: id, saved: !active });
      if ('error' in result) setError(result.error); else setActive(!active);
    } catch { setError('Unable to change favorite. Try again.'); }
    finally { setPending(false); }
  }
  return <span><Button onClick={toggle} disabled={pending} aria-pressed={active} aria-label={active ? 'Remove saved experience' : 'Save experience'}>{pending ? 'Saving…' : active ? 'Saved ♥' : 'Save ♡'}</Button>{error && <span role="alert">{error}</span>}</span>;
}
