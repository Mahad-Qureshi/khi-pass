'use client';
import type { ReactNode } from 'react';
import { styled } from '@mui/material/styles';

const Hero = styled('section')(({ theme }) => ({
  marginTop: theme.spacing(3), padding: theme.spacing(4, 2),
  borderRadius: theme.shape.borderRadius, background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up('md')]: { padding: theme.spacing(7) },
}));
const Eyebrow = styled('p')(({ theme }) => ({
  ...theme.typography.overline, margin: theme.spacing(0, 0, 1),
  color: theme.palette.secondary.main, fontWeight: 700,
}));
const Title = styled('h1')(({ theme }) => ({
  ...theme.typography.h3, maxWidth: theme.breakpoints.values.sm,
  margin: theme.spacing(0, 0, 2),
  [theme.breakpoints.up('md')]: { ...theme.typography.h2 },
}));
const Description = styled('p')(({ theme }) => ({
  ...theme.typography.body1, maxWidth: theme.breakpoints.values.sm,
  margin: theme.spacing(0, 0, 4), color: theme.palette.text.secondary,
}));

export function DiscoveryHero({ children }: { children: ReactNode }) {
  return <Hero aria-labelledby="home-title">
    <Eyebrow>KHI PASS · KARACHI</Eyebrow>
    <Title id="home-title">Karachi mein aaj kya karein?</Title>
    <Description>Discover places, experiences, activities and limited-time PASS Drops across Karachi.</Description>
    {children}
  </Hero>;
}
