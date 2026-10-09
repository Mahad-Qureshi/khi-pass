import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

import { AppProviders } from '@/providers/AppProviders';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'KHI PASS',
    template: '%s | KHI PASS',
  },
  description:
    'Discover places, experiences, activities and PASS Drops across Karachi.',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.variable}>
      {/* Tolerate browser extensions adding attributes to body before hydration. */}
      <body suppressHydrationWarning>
        <AppRouterCacheProvider options={{ key: 'mui' }}>
          <AppProviders>{children}</AppProviders>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}