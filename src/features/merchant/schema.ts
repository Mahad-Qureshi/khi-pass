import { z } from 'zod';

export const uuid = z.string().uuid();
export const merchantKind = z.enum(['venues', 'experiences', 'drops']);
export type MerchantKind = z.infer<typeof merchantKind>;
export type MerchantRole = 'owner' | 'manager' | 'staff';

const slug = z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.');
const nonBlank = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);
const money = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Use valid PKR amount (up to two decimals).');
const optionalMoney = z.union([z.literal(''), money]);
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose Karachi date and time.');

const base = z.object({
  merchantId: uuid,
  id: uuid.optional(),
  title: nonBlank(200),
  slug,
});

export const venueInput = z.object({
  merchantId: uuid, id: uuid.optional(),
  name: nonBlank(160), slug: slug.max(160), areaId: uuid,
  address: nonBlank(1000), phone: optionalText(32),
  googleMapsUrl: z.union([z.literal(''), z.string().url().max(2048)]),
});

export const experienceInput = base.extend({
  venueId: uuid, categoryId: uuid,
  description: nonBlank(20000), minPrice: money, maxPrice: optionalMoney,
  durationMinutes: z.union([z.literal(''), z.coerce.number().int().min(1).max(10080)]),
  minGroupSize: int(1, 10000),
  maxGroupSize: z.union([z.literal(''), z.coerce.number().int().min(1).max(10000)]),
  setting: z.enum(['indoor', 'outdoor', 'mixed']),
  bookingRequired: z.boolean(),
}).superRefine((x, ctx) => {
  if (x.maxPrice !== '' && Number(x.maxPrice) < Number(x.minPrice)) ctx.addIssue({ code: 'custom', path: ['maxPrice'], message: 'Must be at least minimum price.' });
  if (x.maxGroupSize !== '' && x.maxGroupSize < x.minGroupSize) ctx.addIssue({ code: 'custom', path: ['maxGroupSize'], message: 'Must be at least minimum group size.' });
});

export const dropInput = base.extend({
  venueId: uuid, experienceId: z.union([z.literal(''), uuid]),
  description: nonBlank(20000), terms: nonBlank(20000),
  originalPrice: optionalMoney, dropPrice: money,
  startsAt: localDateTime, endsAt: localDateTime,
  claimLimit: int(1, 1000000), perUserLimit: int(1, 1000000),
}).superRefine((x, ctx) => {
  const start = Date.parse(`${x.startsAt}:00+05:00`), end = Date.parse(`${x.endsAt}:00+05:00`);
  const validStart = Number.isFinite(start) && fromKarachiISOString(new Date(start).toISOString()) === x.startsAt;
  const validEnd = Number.isFinite(end) && fromKarachiISOString(new Date(end).toISOString()) === x.endsAt;
  if (!validStart || !validEnd || end <= start) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Use valid dates with end after start.' });
  if (x.originalPrice !== '' && Number(x.dropPrice) > Number(x.originalPrice)) ctx.addIssue({ code: 'custom', path: ['dropPrice'], message: 'Cannot exceed original price.' });
  if (x.perUserLimit > x.claimLimit) ctx.addIssue({ code: 'custom', path: ['perUserLimit'], message: 'Cannot exceed stock.' });
});

export const statusInput = z.object({ merchantId: uuid, kind: merchantKind, id: uuid, status: z.enum(['draft', 'pending_approval', 'archived', 'paused']) });
export const deleteInput = z.object({ merchantId: uuid, kind: merchantKind, id: uuid });

export function toKarachiISOString(value: string): string {
  // datetime-local is interpreted in Karachi, not the browser's timezone.
  const result = new Date(`${value}:00+05:00`);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid Karachi date.');
  return result.toISOString();
}

export function fromKarachiISOString(value: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value)).replace(' ', 'T');
}
