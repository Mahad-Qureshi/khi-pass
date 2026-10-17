import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/features/discovery/public-client';
import { shareId, uuid } from './schema';

export async function publicExperiences(ids: string[]) {
  if (!ids.length) return [];
  const client = await createPublicClient();
  const { data, error } = await client.from('experiences').select('id,slug,title,min_price').in('id', ids).eq('status', 'published');
  if (error) throw new Error('Experiences are unavailable.');
  return data ?? [];
}

export async function publicExperienceOptions() {
  const client = await createPublicClient();
  const { data, error } = await client.from('experiences').select('id,slug,title,min_price').eq('status', 'published').order('title').limit(100);
  if (error) throw new Error('Experiences are unavailable.');
  return data ?? [];
}

export async function myFavoriteIds() {
  const client = await createClient();
  const { data, error } = await client.from('favorites').select('experience_id');
  if (error) throw new Error('Favorites are unavailable.');
  return (data ?? []).map(row => row.experience_id);
}

export async function myPlans() {
  const client = await createClient();
  const { data, error } = await client.from('plans').select('id,title,starts_at,status,share_id,share_expires_at,created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Plans are unavailable.');
  return data ?? [];
}

export async function myPlan(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const client = await createClient();
  const { data: plan, error } = await client.from('plans').select('id,title,starts_at,status,share_id,share_expires_at').eq('id', id).maybeSingle();
  if (error) throw new Error('Plan is unavailable.');
  if (!plan) return null;
  const { data: items, error: itemsError } = await client.from('plan_items').select('id,experience_id,position').eq('plan_id', id).order('position').order('id');
  if (itemsError) throw new Error('Plan items are unavailable.');
  const experiences = await publicExperiences((items ?? []).map(item => item.experience_id));
  const visible = new Map(experiences.map(item => [item.id, item]));
  return { plan, items: (items ?? []).flatMap(item => visible.has(item.experience_id) ? [{ ...item, experience: visible.get(item.experience_id)! }] : []) };
}

export async function sharedPlan(token: string) {
  if (!shareId.safeParse(token).success) return null;
  const client = await createPublicClient();
  const { data, error } = await client.rpc('get_shared_plan', { p_share_id: token });
  if (error) throw new Error('Shared plan is unavailable.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.title !== 'string' || !Array.isArray(raw.items)) return null;
  const items = raw.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item) && uuid.safeParse((item as Record<string, unknown>).experience_id).success && uuid.safeParse((item as Record<string, unknown>).id).success);
  const experiences = await publicExperiences(items.map(item => item.experience_id as string));
  const visible = new Map(experiences.map(item => [item.id, item]));
  return { title: raw.title, startsAt: typeof raw.starts_at === 'string' ? raw.starts_at : null, status: raw.status, items: items.flatMap(item => visible.has(item.experience_id as string) ? [{ id: item.id as string, experience: visible.get(item.experience_id as string)!, yes: Number(item.yes) || 0, maybe: Number(item.maybe) || 0, no: Number(item.no) || 0 }] : []) };
}
