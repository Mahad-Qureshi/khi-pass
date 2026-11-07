'use client';

import { usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import { PageContainer } from './PageContainer';

const links = [
  { label: 'Home', href: '/' }, { label: 'Discover', href: '/discover' },
  { label: 'PASS Drops', href: '/drops' }, { label: 'Plans', href: '/plans' },
];
const active = (pathname: string, href: string) =>
  pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
const accountActive = (pathname: string) =>
  ['/profile', '/passes', '/favorites'].some(href => active(pathname, href));

const Root = styled('header')(({ theme }) => ({
  background: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
const Inner = styled(PageContainer)(({ theme }) => ({
  display: 'flex', alignItems: 'center', gap: theme.spacing(2),
  minHeight: 64,
  [theme.breakpoints.up('md')]: { minHeight: 72, gap: theme.spacing(3) },
}));
const Brand = styled(Link)(({ theme }) => ({
  ...theme.typography.h6, color: theme.palette.primary.main,
  fontWeight: 800, letterSpacing: '-0.035em', whiteSpace: 'nowrap',
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 4 },
}));
const Nav = styled('nav')(({ theme }) => ({
  display: 'none', alignItems: 'center', gap: theme.spacing(0.5), flex: 1,
  [theme.breakpoints.up('md')]: { display: 'flex' },
}));
const NavLink = styled(Link)(({ theme }) => ({
  ...theme.typography.button, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 44, paddingInline: theme.spacing(1.75), borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary, whiteSpace: 'nowrap',
  '&:hover': { color: theme.palette.text.primary, background: theme.palette.action.hover },
  '&[aria-current="page"]': { color: theme.palette.primary.main, background: theme.palette.action.selected },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));
const AccountLink = styled(NavLink)(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.up('md')]: { display: 'inline-flex' },
}));

export function Header({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const accountHref = signedIn ? '/profile' : '/auth/login';
  return <Root><Inner>
    <Brand href="/" aria-label="KHI PASS home" aria-current={pathname === '/' ? 'page' : undefined}>KHI PASS</Brand>
    <Nav aria-label="Primary navigation">{links.map(({ label, href }) =>
      <NavLink key={href} href={href} aria-current={active(pathname, href) ? 'page' : undefined}>{label}</NavLink>
    )}</Nav>
    <AccountLink href={accountHref} aria-current={signedIn && accountActive(pathname) ? 'page' : undefined}>
      {signedIn ? 'Profile' : 'Sign in'}
    </AccountLink>
  </Inner></Root>;
}
