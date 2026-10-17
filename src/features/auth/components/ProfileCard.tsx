'use client';

import { Avatar, Typography, Alert, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import { AuthShell } from './AuthShell';
import { LogoutButton } from './LogoutButton';

const Details = styled('div')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2) }));
function safeAvatar(value: string | null) {
    if (!value) return undefined;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined; }
    catch { return undefined; }
}
export function ProfileCard({ displayName, email, avatar, unavailable, merchantAccess }: { displayName: string | null; email: string | null; avatar: string | null; unavailable: boolean; merchantAccess: boolean }) {
    return <AuthShell title="Your profile" description="Welcome to KHI PASS.">
        <Details>
            {unavailable && <Alert severity="warning">Your profile details are temporarily unavailable.</Alert>}
            <Avatar src={safeAvatar(avatar)} alt={displayName ?? 'Profile avatar'}>{(displayName ?? email ?? '?').slice(0, 1).toUpperCase()}</Avatar>
            <Typography variant="h6" component="h2">{displayName ?? 'KHI PASS member'}</Typography>
            {email && <Typography color="text.secondary">{email}</Typography>}
            <Button component={Link} href="/passes" variant="outlined">My PASSes</Button>
            <Button component={Link} href="/favorites" variant="outlined">Saved experiences</Button>
            <Button component={Link} href="/plans" variant="outlined">My outing plans</Button>
            {merchantAccess && <Button component={Link} href="/merchant/redeem" variant="outlined">Redeem a PASS</Button>}
            <LogoutButton />
        </Details>
    </AuthShell>;
}
