'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import { claimPass } from '../actions';

const Root = styled('div')(({ theme }) => ({ display: 'grid', gap: theme.spacing(1.5), justifyItems: 'start' }));

export function ClaimControl({ dropId, claimable, signedIn, loginHref }: { dropId: string; claimable: boolean; signedIn: boolean; loginHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  async function claim() {
    if (pending) return;
    setPending(true); setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await claimPass({ dropId, requestId: requestId.current });
      if ('error' in result) { setError(result.error); return; }
      router.push(`/passes/${result.id}`);
    } catch { setError('Unable to claim this PASS. Please try again.'); }
    finally { setPending(false); }
  }
  return <Root>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    {!claimable ? <Button disabled variant="contained">Unavailable</Button> : !signedIn ?
      <Button component={Link} href={loginHref} variant="contained">Sign in to claim</Button> :
      <Button onClick={claim} disabled={!claimable || pending} variant="contained" aria-busy={pending}>
        {pending ? 'Claiming…' : claimable ? 'Claim PASS' : 'Unavailable'}
      </Button>}
    {signedIn && <Button component={Link} href="/passes" variant="text">My PASSes</Button>}
  </Root>;
}
