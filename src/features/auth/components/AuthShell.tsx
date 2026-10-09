'use client';

import type { ReactNode } from 'react';
import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';

const Main = styled('main')(({ theme }) => ({
    minHeight: '100svh', display: 'grid', placeItems: 'center', padding: theme.spacing(3, 2),
}));
const Panel = styled(Paper)(({ theme }) => ({
    width: '100%', maxWidth: 440, padding: theme.spacing(3), border: '1px solid ' + theme.palette.divider,
    [theme.breakpoints.up('sm')]: { padding: theme.spacing(4) },
}));
const Brand = styled(Link)(({ theme }) => ({ display: 'inline-block', marginBottom: theme.spacing(3), fontWeight: 800, color: theme.palette.primary.main, textDecoration: 'none' }));
const Title = styled('h1')(({ theme }) => ({ margin: 0, marginBottom: theme.spacing(1), fontSize: '1.75rem', fontWeight: 700 }));
const Content = styled('div')(({ theme }) => ({ marginTop: theme.spacing(3) }));

export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return <Main><Panel elevation={0}>
        <Brand href="/">KHI PASS</Brand>
        <Title>{title}</Title>
        {description && <Typography color="text.secondary">{description}</Typography>}
        <Content>{children}</Content>
    </Panel></Main>;
}
