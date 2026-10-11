import 'server-only';
import { createPublicClient } from '@/features/discovery/public-client';
import type { DropDto } from './types';

export async function getPublicDrops(): Promise<{ items: DropDto[]; error: boolean }> {
  try {
    const client = await createPublicClient();
    const now = new Date().toISOString();
    const { data, error } = await client.from('drops')
      .select('id,slug,title,description,drop_price,original_price,currency,starts_at,ends_at')
      .eq('status', 'active').lte('starts_at', now).gt('ends_at', now)
      .order('ends_at', { ascending: true }).limit(12);
    if (error) throw error;
    return { items: (data ?? []).map((row) => ({
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      price: row.drop_price, originalPrice: row.original_price, currency: 'PKR',
      startsAt: row.starts_at, endsAt: row.ends_at, imageUrl: null,
    })), error: false };
  } catch {
    return { items: [], error: true };
  }
}

export async function getPublicDropBySlug(slug: string): Promise<{ item: DropDto | null; error: boolean }> {
  try {
    const client = await createPublicClient();
    const now = new Date().toISOString();
    const { data, error } = await client.from('drops')
      .select('id,slug,title,description,drop_price,original_price,currency,starts_at,ends_at')
      .eq('slug', slug).eq('status', 'active').lte('starts_at', now).gt('ends_at', now).maybeSingle();
    if (error) throw error;
    return { item: data ? {
      id: data.id, slug: data.slug, title: data.title, description: data.description,
      price: data.drop_price, originalPrice: data.original_price, currency: 'PKR',
      startsAt: data.starts_at, endsAt: data.ends_at, imageUrl: null,
    } : null, error: false };
  } catch {
    return { item: null, error: true };
  }
}
