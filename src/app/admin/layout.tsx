import Link from 'next/link';
import { Suspense } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import { AppShell } from '@/components/shell/AppShell';
import { AuthenticationVerificationError } from '@/lib/supabase/auth';
import { AdminNav } from '@/features/admin/components/AdminUI';
import { requireAdmin } from '@/features/admin/data';

export const metadata = { title: 'KHI PASS administration' };
// Authorization may redirect before a navigation can render its destination.
export const instant = false;

async function Authorized({ children }: { children: React.ReactNode }) {
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof AuthenticationVerificationError ||
      (error instanceof Error && error.message === 'Unable to verify administrator access.')) {
      return <AppShell signedIn><Alert severity="error">Administrator access could not be verified. Try again later.</Alert></AppShell>;
    }
    throw error;
  }
  return <AppShell signedIn><Stack spacing={2} sx={{ py: 3 }}>
    <Typography component="h1" variant="h4">Administration</Typography>
    <AdminNav aria-label="Admin navigation">
      <Link href="/admin">Overview</Link><Link href="/admin/merchants">Merchants</Link>
      <Link href="/admin/venues">Venues</Link><Link href="/admin/experiences">Experiences</Link>
      <Link href="/admin/drops">PASS Drops</Link>
    </AdminNav>
    {children}
  </Stack></AppShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Alert role="status">Loading administration…</Alert>}><Authorized>{children}</Authorized></Suspense>;
}
