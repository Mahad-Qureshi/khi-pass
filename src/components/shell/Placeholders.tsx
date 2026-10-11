'use client';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';

const Panel = styled('section')(({ theme }) => ({
  maxWidth: theme.breakpoints.values.sm, paddingBlock: theme.spacing(8),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(12) },
}));
const Eyebrow = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2), color: theme.palette.secondary.main, fontWeight: 700,
}));
const Heading = styled('h1')(({ theme }) => ({
  ...theme.typography.h2, marginTop: 0, marginBottom: theme.spacing(2), color: theme.palette.text.primary,
}));
const Actions = styled('div')(({ theme }) => ({
  display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1.5), marginTop: theme.spacing(4),
}));

export function HomePlaceholder() {
  return <Panel aria-labelledby="home-title">
    <Eyebrow variant="overline">KHI PASS · KARACHI</Eyebrow>
    <Heading id="home-title">Karachi mein aaj kya karein?</Heading>
    <Typography variant="body1" color="text.secondary">A fresh way to find what&apos;s happening around the city is on its way.</Typography>
    <Actions>
      <Button component={Link} href="/discover" variant="contained">Explore Discover</Button>
      <Button component={Link} href="/drops" variant="outlined">See PASS Drops</Button>
    </Actions>
  </Panel>;
}

export function ComingSoon({ title }: { title: string }) {
  return <Panel aria-labelledby="coming-soon-title">
    <Eyebrow variant="overline">KHI PASS</Eyebrow>
    <Heading id="coming-soon-title">{title}</Heading>
    <Typography variant="body1" color="text.secondary">Coming soon. We&apos;re getting this part of KHI PASS ready.</Typography>
    <Actions><Button component={Link} href="/" variant="outlined">Back to home</Button></Actions>
  </Panel>;
}
