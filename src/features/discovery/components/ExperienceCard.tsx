'use client';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import type { ExperienceDto } from '../types';

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

export function ExperienceCard({ experience }: { experience: ExperienceDto }) {
  return <Card>
    <ImageArea role="img" aria-label="Image not available">KHI PASS</ImageArea>
    <Body>
      <Typography variant="caption" color="text.secondary">{experience.category} · {experience.area}</Typography>
      <Title><TitleLink href={`/discover/${experience.slug}`}>{experience.title}</TitleLink></Title>
      <Typography variant="body2" color="text.secondary">{experience.venue}</Typography>
      <Typography variant="body1">From Rs {experience.price.toLocaleString('en-PK')}</Typography>
    </Body>
  </Card>;
}
