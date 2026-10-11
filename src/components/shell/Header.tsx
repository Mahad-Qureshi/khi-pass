'use client';
import { usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import { PageContainer } from './PageContainer';

const links = [
  { label: 'Home', href: '/' }, { label: 'Discover', href: '/discover' },
  { label: 'PASS Drops', href: '/drops' }, { label: 'Plans', href: '/plans' },
];
const Root = styled('header')(({ theme }) => ({
  display: 'none', background: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up('md')]: { display: 'block' },
}));
const Inner = styled(PageContainer)(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: theme.spacing(4), minHeight: theme.spacing(9),
}));
const Brand = styled(Link)(({ theme }) => ({
  ...theme.typography.h6, fontWeight: 800, whiteSpace: 'nowrap', color: theme.palette.primary.main,
  '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.main}`, outlineOffset: theme.spacing(0.5) },
}));
const Nav = styled('nav')(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: theme.spacing(1), flex: 1,
}));
const NavLink = styled(Link)(({ theme }) => ({
  ...theme.typography.button, display: 'inline-flex', alignItems: 'center', minHeight: theme.spacing(5.5),
  paddingInline: theme.spacing(1.5), borderRadius: theme.shape.borderRadius, color: theme.palette.text.secondary,
  '&[aria-current="page"]': { color: theme.palette.primary.main, background: theme.palette.action.selected },
  '&:hover': { background: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.main}`, outlineOffset: theme.spacing(0.5) },
}));

export function Header({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  return <Root><Inner>
    <Brand href="/">KHI PASS</Brand>
    <Nav aria-label="Primary navigation">{links.map(({ label, href }) =>
      <NavLink key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</NavLink>
    )}</Nav>
    <NavLink href={signedIn ? '/profile' : '/auth/login'}>{signedIn ? 'My account' : 'Sign in'}</NavLink>
  </Inner></Root>;
}
