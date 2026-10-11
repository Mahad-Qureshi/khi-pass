'use client';
import type { ReactNode } from 'react';
import { styled } from '@mui/material/styles';

const Section = styled('section')(({ theme }) => ({ marginBlock: theme.spacing(6) }));
const Heading = styled('h2')(({ theme }) => ({ ...theme.typography.h4, margin: theme.spacing(0, 0, 2) }));
const Grid = styled('div')(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  [theme.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
}));
const Empty = styled('p')(({ theme }) => ({
  ...theme.typography.body1, margin: 0, padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius, border: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.secondary, background: theme.palette.background.paper,
}));

export function DiscoverySection({ title, children, empty }: { title: string; children?: ReactNode; empty: string }) {
  return <Section aria-label={title}><Heading>{title}</Heading>{children ? <Grid>{children}</Grid> : <Empty>{empty}</Empty>}</Section>;
}
