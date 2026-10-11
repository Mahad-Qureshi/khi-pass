import 'server-only';
import { createPublicClient } from './public-client';
import { budgetOptions, groupOptions, type DiscoveryFilters, type ReferenceData } from './filters';
import { matchesWindow, selectedWindow } from './time';
import type { ExperienceDto } from './types';
import type { Database } from '@/types/database.types';

type Result = { items: ExperienceDto[]; error: boolean };
type Venue = Pick<Database['public']['Tables']['venues']['Row'], 'id' | 'name' | 'area_id'>;
type VibeLink = Database['public']['Tables']['experience_vibes']['Row'];
type Schedule = Pick<Database['public']['Tables']['experience_schedules']['Row'], 'experience_id' | 'weekday' | 'opens_at' | 'closes_at' | 'valid_from' | 'valid_until'>;

export async function getPublicExperiences(filters: DiscoveryFilters, refs: ReferenceData, slug?: string): Promise<Result> {
  try {
    const client = await createPublicClient();
    const rows: Array<{ id: string; slug: string; title: string; description: string; min_price: number; max_price: number | null; currency: string; venue_id: string; category_id: string; min_group_size: number; max_group_size: number | null; starts_at: string | null; ends_at: string | null; created_at: string; featured: boolean }> = [];
    const budget = budgetOptions.find((option) => option.value === filters.budget);
    const group = groupOptions.find((option) => option.value === filters.group);
    for (let offset = 0; ; offset += 500) {
      let query = client.from('experiences').select('id,slug,title,description,min_price,max_price,currency,venue_id,category_id,min_group_size,max_group_size,starts_at,ends_at,created_at,featured').eq('status', 'published').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
      if (slug) query = query.eq('slug', slug);
      if (budget) {
        query = query.gte('min_price', budget.min);
        if (budget.max !== null) query = query.lte('min_price', budget.max);
      }
      if (group) query = query.lte('min_group_size', group.size).or(`max_group_size.is.null,max_group_size.gte.${group.size}`);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    if (!rows.length) return { items: [], error: false };
    const venueRows: Venue[] = [], vibeLinks: VibeLink[] = [], scheduleRows: Schedule[] = [];
    for (let offset = 0; offset < rows.length; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      const ids = batch.map((row) => row.id);
      const venueIds = [...new Set(batch.map((row) => row.venue_id))];
      const [venues, links, schedules] = await Promise.all([
        client.from('venues').select('id,name,area_id').in('id', venueIds),
        client.from('experience_vibes').select('experience_id,vibe_id').in('experience_id', ids),
        client.from('experience_schedules').select('experience_id,weekday,opens_at,closes_at,valid_from,valid_until').in('experience_id', ids),
      ]);
      if (venues.error || links.error || schedules.error) throw new Error('Related discovery data unavailable.');
      venueRows.push(...(venues.data ?? []));
      vibeLinks.push(...(links.data ?? []));
      scheduleRows.push(...(schedules.data ?? []));
    }
    const venueById = new Map(venueRows.map((venue) => [venue.id, venue]));
    const areaById = new Map(refs.areas.map((area) => [area.id, area]));
    const categoryById = new Map(refs.categories.map((category) => [category.id, category]));
    const vibeById = new Map(refs.vibes.map((vibe) => [vibe.id, vibe]));
    const now = new Date();
    const window = selectedWindow(filters.when, now);
    const items = rows.flatMap((row) => {
      const venue = venueById.get(row.venue_id);
      const area = venue && areaById.get(venue.area_id);
      const category = categoryById.get(row.category_id);
      if (!venue || !area || !category) return [];
      const vibeSlugs = vibeLinks.filter((link) => link.experience_id === row.id).map((link) => vibeById.get(link.vibe_id)?.slug).filter((slug): slug is string => Boolean(slug));
      if (filters.area && area.slug !== filters.area) return [];
      if (filters.category && category.slug !== filters.category) return [];
      if (filters.vibe && !vibeSlugs.includes(filters.vibe)) return [];
      const slots = scheduleRows.filter((slot) => slot.experience_id === row.id);
      if (!matchesWindow({ starts_at: row.starts_at, ends_at: row.ends_at, schedules: slots }, window)) return [];
      return [{ id: row.id, slug: row.slug, title: row.title, description: row.description, venue: venue.name, area: area.name, category: category.name, price: row.min_price, maxPrice: row.max_price, currency: 'PKR' as const, imageUrl: null, createdAt: row.created_at, featured: row.featured, vibeSlugs }];
    });
    return { items, error: false };
  } catch {
    return { items: [], error: true };
  }
}
