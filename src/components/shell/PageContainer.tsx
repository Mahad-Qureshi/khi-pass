'use client';
import { styled } from '@mui/material/styles';
export const PageContainer = styled('div')(({ theme }) => ({
  width: '100%', maxWidth: theme.breakpoints.values.lg, marginInline: 'auto',
  paddingInline: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(3) },
  [theme.breakpoints.up('lg')]: { paddingInline: theme.spacing(4) },
}));
