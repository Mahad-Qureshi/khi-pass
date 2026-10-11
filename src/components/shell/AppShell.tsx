import type { ReactNode } from 'react';
import { Header } from './Header';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { PageContainer } from './PageContainer';

export function AppShell({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Header signedIn={signedIn} />
    <main id="main-content" className="public-main"><PageContainer>{children}</PageContainer></main>
    <MobileBottomNavigation signedIn={signedIn} />
  </>;
}
