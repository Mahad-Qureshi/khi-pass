import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/supabase/auth';
import { loginPath } from '@/features/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { uuid, type MerchantKind, type MerchantRole } from './schema';

export type MerchantMembership = {
  id: string;
  name: string;
  status: string;
  role: MerchantRole;
};

export async function getMerchantMemberships(next = '/merchant'): Promise<MerchantMembership[]> {
  const user = await requireAuthenticatedUser().catch((error: unknown) => {
    if (error instanceof AuthenticationRequiredError) redirect(loginPath(next));
    throw error;
  });
  const client = await createClient();
  const { data: memberships, error } = await client.from('merchant_members')
    .select('merchant_id,role').eq('user_id', user.id).order('created_at', { ascending: true });
  if (error) throw new Error('Merchant membership lookup failed.');
  if (!memberships?.length) return [];
  const ids = memberships.map(m => m.merchant_id);
  const { data: businesses, error: businessError } = await client.from('merchants')
    .select('id,business_name,status').in('id', ids);
  if (businessError) throw new Error('Merchant business lookup failed.');
  const byId = new Map((businesses ?? []).map(m => [m.id, m]));
  return memberships.flatMap(m => {
    const business = byId.get(m.merchant_id);
    if (!business || !['owner', 'manager', 'staff'].includes(m.role)) return [];
    return [{ id: business.id, name: business.business_name, status: business.status, role: m.role as MerchantRole }];
  });
}

export async function requireMerchant(merchantId: string, next?: string): Promise<MerchantMembership> {
  if (!uuid.safeParse(merchantId).success) notFound();
  const found = (await getMerchantMemberships(next ?? `/merchant/${merchantId}`)).find(m => m.id === merchantId);
  if (!found) notFound();
  return found;
}

export function canManage(membership: MerchantMembership): boolean {
  return membership.status !== 'suspended' && (membership.role === 'owner' || membership.role === 'manager');
}

export async function merchantContentList(merchantId: string, kind: MerchantKind, page: number) {
  const from = (page - 1) * 20;
  const to = from + 19;
  const client = await createClient();
  if (kind === 'venues') {
    const { data, error, count } = await client.from('venues').select('id,name,status,updated_at', { count: 'exact' })
      .eq('merchant_id', merchantId).order('updated_at', { ascending: false }).range(from, to);
    if (error) throw new Error('Unable to load venues.');
    return { items: (data ?? []).map(x => ({ id: x.id, title: x.name, status: x.status, updatedAt: x.updated_at })), total: count ?? 0 };
  }
  if (kind === 'experiences') {
    const { data, error, count } = await client.from('experiences').select('id,title,status,updated_at', { count: 'exact' })
      .eq('merchant_id', merchantId).order('updated_at', { ascending: false }).range(from, to);
    if (error) throw new Error('Unable to load experiences.');
    return { items: (data ?? []).map(x => ({ id: x.id, title: x.title, status: x.status, updatedAt: x.updated_at })), total: count ?? 0 };
  }
  const { data, error, count } = await client.from('drops').select('id,title,status,updated_at', { count: 'exact' })
    .eq('merchant_id', merchantId).order('updated_at', { ascending: false }).range(from, to);
  if (error) throw new Error('Unable to load PASS Drops.');
  return { items: (data ?? []).map(x => ({ id: x.id, title: x.title, status: x.status, updatedAt: x.updated_at })), total: count ?? 0 };
}

export async function merchantReferences(merchantId: string) {
  const client = await createClient();
  const [areas, categories, venues, experiences] = await Promise.all([
    client.from('areas').select('id,name').eq('is_active', true).order('name'),
    client.from('categories').select('id,name').eq('is_active', true).order('name'),
    client.from('venues').select('id,name').eq('merchant_id', merchantId).order('name'),
    client.from('experiences').select('id,title,venue_id').eq('merchant_id', merchantId).order('title'),
  ]);
  if (areas.error || categories.error || venues.error || experiences.error) throw new Error('Merchant form options are unavailable.');
  return { areas: areas.data ?? [], categories: categories.data ?? [], venues: venues.data ?? [], experiences: experiences.data ?? [] };
}

export async function merchantOverview(merchantId: string) {
  const client = await createClient();
  const until = new Date();
  const from = new Date(until.getTime() - 30 * 86400000);
  const [venues, experiences, drops, analytics] = await Promise.all([
    client.from('venues').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    client.from('experiences').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    client.from('drops').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId),
    client.rpc('merchant_claim_stats', { p_merchant_id: merchantId, p_from: from.toISOString(), p_until: until.toISOString() }),
  ]);
  if (venues.error || experiences.error || drops.error || analytics.error) throw new Error('Unable to load merchant analytics.');
  const counts = z.object({
    issued: z.number().int().nonnegative(), redeemed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(), expired: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }).parse(analytics.data);
  return { venues: venues.count ?? 0, experiences: experiences.count ?? 0, drops: drops.count ?? 0,
    ...counts, windowDays: 30 };
}

export async function merchantExperienceExtras(merchantId: string, experienceId: string) {
  const client = await createClient();
  const [schedules, selectedVibes, vibes] = await Promise.all([
    client.from('experience_schedules').select('id,weekday,opens_at,closes_at')
      .eq('experience_id', experienceId).order('weekday').order('opens_at'),
    client.from('experience_vibes').select('vibe_id').eq('experience_id', experienceId),
    client.from('vibes').select('id,name').eq('is_active', true).order('name'),
  ]);
  if (schedules.error || selectedVibes.error || vibes.error) throw new Error('Unable to load availability or vibes.');
  return { merchantId, experienceId, schedules: schedules.data ?? [],
    selectedVibes: (selectedVibes.data ?? []).map(x => x.vibe_id), vibes: vibes.data ?? [] };
}
