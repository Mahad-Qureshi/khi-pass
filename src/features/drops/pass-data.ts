import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { pass, passList, uuid } from './pass-schema';

export async function getMyPasses(page: number) {
  const client = await createClient();
  const { data, error } = await client.rpc('list_my_passes', { p_limit: 20, p_offset: page * 20 });
  if (error) throw new Error('PASS list is unavailable.');
  return passList.parse(data);
}

export async function getMyPass(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const client = await createClient();
  const { data, error } = await client.rpc('get_my_pass_details', { p_claim_id: id });
  if (error?.message === 'PASS_NOT_AVAILABLE') return null;
  if (error) throw new Error('PASS details are unavailable.');
  return pass.parse(data);
}
