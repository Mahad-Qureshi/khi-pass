import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { AuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { adminId } from './schema';

export async function requireAdmin(next = '/admin') {
  const user = await requireAuthenticatedUser().catch((error: unknown) => {
    if (error instanceof AuthenticationRequiredError) redirect(loginPath(next));
    throw error;
  });
  const client = await createClient();
  const { data, error } = await client.rpc('is_platform_admin');
  if (error) throw new Error('Unable to verify administrator access.');
  if (!data) notFound();
  return user;
}

export async function adminOverview() {
  await requireAdmin();
  const client = await createClient();
  const specs = [
    ['merchants', 'pending'], ['venues', 'pending_approval'],
    ['experiences', 'pending_approval'], ['drops', 'pending_approval'],
  ] as const;
  const counts = await Promise.all(specs.map(async ([table, pending]) => {
    const [total, waiting] = await Promise.all([
      client.from(table).select('id', { count: 'exact', head: true }),
      client.from(table).select('id', { count: 'exact', head: true }).eq('status', pending),
    ]);
    if (total.error || waiting.error) throw new Error('Admin overview is unavailable.');
    return { table, total: total.count ?? 0, pending: waiting.count ?? 0 };
  }));
  return counts;
}

export async function adminList(kind: 'merchant' | 'venue' | 'experience' | 'drop', search: string, status: string, page: number) {
  await requireAdmin();
  const client = await createClient();
  // Separate typed queries keep each table's permitted columns explicit.
  if (kind === 'merchant') {
    let merchants = client.from('merchants').select('id,business_name,status,created_at', { count: 'exact' });
    if (search) merchants = merchants.ilike('business_name', `%${search}%`);
    if (status) merchants = merchants.eq('status', status);
    const { data, error, count } = await merchants.order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
    if (error) throw new Error('Unable to load merchants.');
    return { items: (data ?? []).map(x => ({ id: x.id, title: x.business_name, status: x.status, merchantId: x.id })), total: count ?? 0 };
  }
  if (kind === 'venue') {
    let query = client.from('venues').select('id,name,status,merchant_id', { count: 'exact' });
    if (search) query = query.ilike('name', `%${search}%`);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
    if (error) throw new Error('Unable to load venues.');
    return { items: (data ?? []).map(x => ({ id: x.id, title: x.name, status: x.status, merchantId: x.merchant_id })), total: count ?? 0 };
  }
  if (kind === 'experience') {
    let query = client.from('experiences').select('id,title,status,merchant_id', { count: 'exact' });
    if (search) query = query.ilike('title', `%${search}%`);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
    if (error) throw new Error('Unable to load experiences.');
    return { items: (data ?? []).map(x => ({ id: x.id, title: x.title, status: x.status, merchantId: x.merchant_id })), total: count ?? 0 };
  }
  let query = client.from('drops').select('id,title,status,merchant_id', { count: 'exact' });
  if (search) query = query.ilike('title', `%${search}%`);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error('Unable to load PASS Drops.');
  return { items: (data ?? []).map(x => ({ id: x.id, title: x.title, status: x.status, merchantId: x.merchant_id })), total: count ?? 0 };
}

export async function adminDetail(kind: 'merchant' | 'venue' | 'experience' | 'drop', id: string) {
  if (!adminId.safeParse(id).success) notFound();
  await requireAdmin();
  const client = await createClient();
  if (kind === 'merchant') {
    const [record, memberships] = await Promise.all([
      client.from('merchants').select('id,business_name,slug,business_type,description,status,created_at').eq('id', id).maybeSingle(),
      client.from('merchant_members').select('user_id,role,created_at').eq('merchant_id', id),
    ]);
    if (record.error || memberships.error) throw new Error('Merchant details unavailable.');
    if (!record.data) notFound();
    return { record: record.data, members: memberships.data ?? [] };
  }
  const table = ({ venue: 'venues', experience: 'experiences', drop: 'drops' } as const)[kind];
  const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Content details unavailable.');
  if (!data) notFound();
  return { record: data, members: [] };
}

export async function adminUserOptions(search: string) {
  await requireAdmin();
  const client = await createClient();
  let query = client.from('profiles').select('id,display_name').order('display_name').limit(25);
  if (search) query = adminId.safeParse(search).success ? query.eq('id', search) : query.ilike('display_name', `%${search}%`);
  const { data, error } = await query;
  if (error) throw new Error('Unable to load registered users.');
  return data ?? [];
}
