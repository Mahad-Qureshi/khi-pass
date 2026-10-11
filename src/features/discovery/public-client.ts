import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { connection } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import type { Database } from '@/types/database.types';

// Always use the anonymous RLS view for public discovery, even for signed-in merchants.
export async function createPublicClient() {
  await connection();
  const { url, publishableKey } = getSupabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
