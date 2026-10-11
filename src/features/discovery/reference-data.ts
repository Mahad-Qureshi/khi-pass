import 'server-only';
import { createPublicClient } from './public-client';
import type { ReferenceData } from './filters';

export async function getReferenceData(): Promise<ReferenceData> {
  const client = await createPublicClient();
  const [areas, categories, vibes] = await Promise.all([
    client.from('areas').select('id,slug,name').eq('is_active', true).order('sort_order').order('name'),
    client.from('categories').select('id,slug,name').eq('is_active', true).order('sort_order').order('name'),
    client.from('vibes').select('id,slug,name').eq('is_active', true).order('sort_order').order('name'),
  ]);
  if (areas.error || categories.error || vibes.error) throw new Error('Discovery options are unavailable.');
  return { areas: areas.data ?? [], categories: categories.data ?? [], vibes: vibes.data ?? [] };
}
