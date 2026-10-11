import { z } from 'zod';

export const budgetOptions = [
  { value: 'under-2000', label: 'Under Rs 2,000', min: 0, max: 2000 },
  { value: '2000-5000', label: 'Rs 2,000–5,000', min: 2000, max: 5000 },
  { value: '5000-plus', label: 'Rs 5,000+', min: 5000, max: null },
] as const;
export const groupOptions = [
  { value: 'solo', label: 'Solo', size: 1 },
  { value: 'couple', label: 'Couple', size: 2 },
  { value: 'friends', label: 'Friends', size: 4 },
  { value: 'family', label: 'Family', size: 4 },
] as const;
export const whenOptions = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'weekend', label: 'Weekend' },
] as const;

export const filterKeys = ['when', 'area', 'budget', 'vibe', 'group', 'category'] as const;
export type FilterKey = typeof filterKeys[number];
export type RawSearchParams = Record<string, string | string[] | undefined>;
export type ReferenceOption = { id: string; slug: string; name: string };
export type ReferenceData = { areas: ReferenceOption[]; categories: ReferenceOption[]; vibes: ReferenceOption[] };
export type DiscoveryFilters = Record<FilterKey, string>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const one = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';
const valid = (value: string, options: readonly { value: string }[]) => options.some((option) => option.value === value) ? value : '';

export function normalizeFilters(raw: RawSearchParams, refs: ReferenceData): DiscoveryFilters {
  const reference = (value: string, options: ReferenceOption[]) =>
    slug.safeParse(value).success && options.some((option) => option.slug === value) ? value : '';
  return {
    when: valid(one(raw.when), whenOptions),
    area: reference(one(raw.area), refs.areas),
    budget: valid(one(raw.budget), budgetOptions),
    vibe: reference(one(raw.vibe), refs.vibes),
    group: valid(one(raw.group), groupOptions),
    category: reference(one(raw.category), refs.categories),
  };
}

export function filterQuery(filters: DiscoveryFilters) {
  const params = new URLSearchParams();
  for (const key of filterKeys) if (filters[key]) params.set(key, filters[key]);
  return params.toString();
}

export function discoverHref(filters: DiscoveryFilters) {
  const query = filterQuery(filters);
  return `/discover${query ? `?${query}` : ''}`;
}
