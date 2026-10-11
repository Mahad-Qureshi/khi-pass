'use client';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import type { DropDto } from '../types';

const Card = styled('article')(({ theme }) => ({
  overflow: 'hidden', border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius, background: theme.palette.background.paper,
}));
const ImageArea = styled('div')(({ theme }) => ({
  aspectRatio: '16 / 10', display: 'grid', placeItems: 'center',
  background: theme.palette.action.hover, color: theme.palette.text.secondary,
}));
const Body = styled('div')(({ theme }) => ({ padding: theme.spacing(2) }));
const Title = styled('h3')(({ theme }) => ({ ...theme.typography.h6, margin: theme.spacing(1, 0) }));
const TitleLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.primary,
  '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.main}`, outlineOffset: theme.spacing(0.5) },
}));

export function DropCard({ drop }: { drop: DropDto }) {
  return <Card>
    <ImageArea role="img" aria-label="Image not available">KHI PASS</ImageArea>
    <Body>
      <Typography variant="caption" color="text.secondary">PASS Drop</Typography>
      <Title><TitleLink href={`/drops/${drop.slug}`}>{drop.title}</TitleLink></Title>
      <Typography variant="body1">Rs {drop.price.toLocaleString('en-PK')}</Typography>
    </Body>
  </Card>;
}
