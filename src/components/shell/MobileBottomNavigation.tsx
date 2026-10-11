'use client';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CardMembershipOutlinedIcon from '@mui/icons-material/CardMembershipOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import { usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';

const Root = styled('nav')(({ theme }) => ({
  position: 'fixed', zIndex: theme.zIndex.appBar, insetInline: 0, bottom: 0,
  display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  paddingBottom: 'env(safe-area-inset-bottom)', background: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up('md')]: { display: 'none' },
}));
const NavLink = styled(Link)(({ theme }) => ({
  ...theme.typography.caption, display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: theme.spacing(0.5), minHeight: theme.spacing(8),
  color: theme.palette.text.secondary, textAlign: 'center',
  '&[aria-current="page"]': { color: theme.palette.secondary.main, fontWeight: 700 },
  '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.main}`, outlineOffset: -theme.spacing(0.5) },
}));
const links = [
  { label: 'Home', href: '/', icon: HomeOutlinedIcon },
  { label: 'Discover', href: '/discover', icon: ExploreOutlinedIcon },
  { label: 'Drops', href: '/drops', icon: LocalOfferOutlinedIcon },
  { label: 'Plans', href: '/plans', icon: CardMembershipOutlinedIcon },
];

export function MobileBottomNavigation({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const accountHref = signedIn ? '/profile' : '/auth/login';
  return <Root aria-label="Mobile navigation">
    {links.map(({ label, href, icon: Icon }) =>
      <NavLink key={href} href={href} aria-label={label} aria-current={pathname === href ? 'page' : undefined}>
        <Icon aria-hidden="true" fontSize="small" />{label}
      </NavLink>
    )}
    <NavLink href={accountHref} aria-label="Account" aria-current={pathname === accountHref ? 'page' : undefined}>
      <PersonOutlineIcon aria-hidden="true" fontSize="small" />Account
    </NavLink>
  </Root>;
}
