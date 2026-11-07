'use client';

import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CardMembershipOutlinedIcon from '@mui/icons-material/CardMembershipOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';

const Root = styled('nav')(({ theme }) => ({
  position: 'fixed', zIndex: theme.zIndex.appBar, insetInline: 0, bottom: 0,
  paddingBottom: 'env(safe-area-inset-bottom)', background: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up('md')]: { display: 'none' },
}));
const Inner = styled('div')({
  display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  width: '100%', maxWidth: 640, marginInline: 'auto',
});
const NavLink = styled(Link)(({ theme }) => ({
  ...theme.typography.caption, position: 'relative', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: theme.spacing(0.5),
  minHeight: 72, color: theme.palette.text.secondary, textAlign: 'center',
  fontWeight: 600, whiteSpace: 'nowrap',
  '&:hover': { color: theme.palette.text.primary, background: theme.palette.action.hover },
  '&[aria-current="page"]': { color: theme.palette.primary.main, background: theme.palette.action.selected, fontWeight: 700 },
  '&[aria-current="page"]::before': {
    content: '""', position: 'absolute', top: 0, width: 32, height: 3,
    borderRadius: 2, background: theme.palette.primary.main,
  },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -4 },
}));
const links = [
  { label: 'Discover', href: '/discover', icon: ExploreOutlinedIcon },
  { label: 'Drops', accessibleLabel: 'PASS Drops', href: '/drops', icon: LocalOfferOutlinedIcon },
  { label: 'Plans', href: '/plans', icon: CardMembershipOutlinedIcon },
];
const active = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
const accountActive = (pathname: string) =>
  ['/profile', '/passes', '/favorites'].some(href => active(pathname, href));

export function MobileBottomNavigation({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const accountHref = signedIn ? '/profile' : '/auth/login';
  return <Root aria-label="Mobile navigation"><Inner>
    {links.map(({ label, accessibleLabel, href, icon: Icon }) =>
      <NavLink key={href} href={href} aria-label={accessibleLabel ?? label}
        aria-current={active(pathname, href) ? 'page' : undefined}>
        <Icon aria-hidden="true" fontSize="small" />{label}
      </NavLink>
    )}
    <NavLink href={accountHref} aria-label={signedIn ? 'Profile' : 'Sign in'}
      aria-current={signedIn && accountActive(pathname) ? 'page' : undefined}>
      <PersonOutlineIcon aria-hidden="true" fontSize="small" />{signedIn ? 'Profile' : 'Sign in'}
    </NavLink>
  </Inner></Root>;
}
