'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canManage, requireMerchant } from './data';
import {
  deleteInput, dropInput, experienceInput, statusInput, toKarachiISOString, venueInput,
  type MerchantKind,
} from './schema';

export type MerchantResult = { ok: true; id?: string } | { error: string };
const invalid: MerchantResult = { error: 'Check the form values and try again.' };
const unavailable: MerchantResult = { error: 'Unable to save changes. Check permissions, uniqueness and linked content.' };

async function authorize(merchantId: string) {
  // Authorization repeats inside each Server Action; the layout is never trusted as a guard.
  const merchant = await requireMerchant(merchantId);
  return canManage(merchant);
}

function refresh(merchantId: string, kind: MerchantKind, id?: string) {
  revalidatePath(`/merchant/${merchantId}`);
  revalidatePath(`/merchant/${merchantId}/${kind}`);
  if (id) revalidatePath(`/merchant/${merchantId}/${kind}/${id}`);
}

export async function saveVenue(input: unknown): Promise<MerchantResult> {
  const parsed = venueInput.safeParse(input);
  if (!parsed.success) return invalid;
  const x = parsed.data;
  try {
    if (!await authorize(x.merchantId)) return { error: 'Owner or manager access required.' };
    const client = await createClient();
    const values = { name: x.name, slug: x.slug, area_id: x.areaId, address: x.address,
      phone: x.phone || null, google_maps_url: x.googleMapsUrl || null };
    const result = x.id
      ? await client.from('venues').update(values).eq('id', x.id).eq('merchant_id', x.merchantId).select('id').maybeSingle()
      : await client.from('venues').insert({ merchant_id: x.merchantId, ...values }).select('id').single();
    if (result.error || !result.data) return unavailable;
    refresh(x.merchantId, 'venues', result.data.id);
    return { ok: true, id: result.data.id };
  } catch { return unavailable; }
}

export async function saveExperience(input: unknown): Promise<MerchantResult> {
  const parsed = experienceInput.safeParse(input);
  if (!parsed.success) return invalid;
  const x = parsed.data;
  try {
    if (!await authorize(x.merchantId)) return { error: 'Owner or manager access required.' };
    const client = await createClient();
    const values = {
      venue_id: x.venueId, category_id: x.categoryId, title: x.title, slug: x.slug,
      description: x.description, min_price: Number(x.minPrice),
      max_price: x.maxPrice === '' ? null : Number(x.maxPrice),
      duration_minutes: x.durationMinutes === '' ? null : x.durationMinutes,
      min_group_size: x.minGroupSize,
      max_group_size: x.maxGroupSize === '' ? null : x.maxGroupSize,
      setting: x.setting, booking_required: x.bookingRequired,
    };
    const result = x.id
      ? await client.from('experiences').update(values).eq('id', x.id).eq('merchant_id', x.merchantId).select('id').maybeSingle()
      : await client.from('experiences').insert({ merchant_id: x.merchantId, ...values }).select('id').single();
    if (result.error || !result.data) return unavailable;
    refresh(x.merchantId, 'experiences', result.data.id);
    return { ok: true, id: result.data.id };
  } catch { return unavailable; }
}

export async function saveDrop(input: unknown): Promise<MerchantResult> {
  const parsed = dropInput.safeParse(input);
  if (!parsed.success) return invalid;
  const x = parsed.data;
  try {
    if (!await authorize(x.merchantId)) return { error: 'Owner or manager access required.' };
    const client = await createClient();
    const values = {
      venue_id: x.venueId, experience_id: x.experienceId || null,
      title: x.title, slug: x.slug, description: x.description, terms: x.terms,
      original_price: x.originalPrice === '' ? null : Number(x.originalPrice),
      drop_price: Number(x.dropPrice), starts_at: toKarachiISOString(x.startsAt),
      ends_at: toKarachiISOString(x.endsAt),
    };
    // claim_limit / per_user_limit deliberately immutable in dashboard after creation.
    // Direct update grants prevent a merchant silently changing issued stock or user limits.
    const result = x.id
      ? await client.from('drops').update(values).eq('id', x.id).eq('merchant_id', x.merchantId).select('id').maybeSingle()
      : await client.from('drops').insert({ merchant_id: x.merchantId, ...values,
          claim_limit: x.claimLimit, per_user_limit: x.perUserLimit }).select('id').single();
    if (result.error || !result.data) return unavailable;
    refresh(x.merchantId, 'drops', result.data.id);
    return { ok: true, id: result.data.id };
  } catch { return unavailable; }
}

export async function setMerchantContentStatus(input: unknown): Promise<MerchantResult> {
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return invalid;
  const { merchantId, kind, id, status } = parsed.data;
  if (kind === 'drops' ? !['draft', 'pending_approval', 'paused'].includes(status) :
    !['draft', 'pending_approval', 'archived'].includes(status)) return invalid;
  try {
    if (!await authorize(merchantId)) return { error: 'Owner or manager access required.' };
    const client = await createClient();
    // Check selected tenant explicitly, in addition to RPC's internal membership check.
    const exists = kind === 'venues'
      ? await client.from('venues').select('id').eq('id', id).eq('merchant_id', merchantId).maybeSingle()
      : kind === 'experiences'
        ? await client.from('experiences').select('id').eq('id', id).eq('merchant_id', merchantId).maybeSingle()
        : await client.from('drops').select('id').eq('id', id).eq('merchant_id', merchantId).maybeSingle();
    if (exists.error || !exists.data) return { error: 'Content not found for selected business.' };
    const { error } = await client.rpc('merchant_set_content_status', {
      p_kind: kind === 'venues' ? 'venue' : kind === 'experiences' ? 'experience' : 'drop',
      p_id: id, p_status: status,
    });
    if (error) return { error: 'Status change denied or unavailable.' };
    refresh(merchantId, kind, id);
    return { ok: true, id };
  } catch { return { error: 'Unable to change status.' }; }
}

export async function deleteMerchantContent(input: unknown): Promise<MerchantResult> {
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return invalid;
  const { merchantId, kind, id } = parsed.data;
  try {
    if (!await authorize(merchantId)) return { error: 'Owner or manager access required.' };
    const client = await createClient();
    // Database delete policies allow drafts/rejected only; FK references may also block deletion.
    const result = kind === 'venues'
      ? await client.from('venues').delete().eq('id', id).eq('merchant_id', merchantId).select('id')
      : kind === 'experiences'
        ? await client.from('experiences').delete().eq('id', id).eq('merchant_id', merchantId).select('id')
        : await client.from('drops').delete().eq('id', id).eq('merchant_id', merchantId).select('id');
    if (result.error || result.data?.length !== 1) return { error: 'Only unlinked drafts or rejected content can be deleted.' };
    refresh(merchantId, kind, id);
    return { ok: true };
  } catch { return { error: 'Unable to delete content.' }; }
}

import { z } from 'zod';
import { uuid } from './schema';

const experienceChild = z.object({ merchantId: uuid, experienceId: uuid });
const scheduleInput = experienceChild.extend({
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine(x => x.closesAt > x.opensAt, { path: ['closesAt'], message: 'Closing time must be later.' });

async function authorizeExperience(merchantId: string, experienceId: string): Promise<boolean> {
  if (!await authorize(merchantId)) return false;
  const client = await createClient();
  const { data, error } = await client.from('experiences').select('id')
    .eq('id', experienceId).eq('merchant_id', merchantId).maybeSingle();
  return !error && !!data;
}

export async function addExperienceSchedule(input: unknown): Promise<MerchantResult> {
  const parsed = scheduleInput.safeParse(input);
  if (!parsed.success) return invalid;
  const x = parsed.data;
  try {
    if (!await authorizeExperience(x.merchantId, x.experienceId)) return { error: 'Experience unavailable.' };
    const client = await createClient();
    const { error } = await client.from('experience_schedules').insert({
      experience_id: x.experienceId, weekday: x.weekday, opens_at: x.opensAt, closes_at: x.closesAt,
    });
    if (error) return { error: 'Unable to add schedule. Check duplicate or time range.' };
    refresh(x.merchantId, 'experiences', x.experienceId);
    return { ok: true };
  } catch { return unavailable; }
}

export async function removeExperienceSchedule(input: unknown): Promise<MerchantResult> {
  const parsed = experienceChild.extend({ scheduleId: uuid }).safeParse(input);
  if (!parsed.success) return invalid;
  const x = parsed.data;
  try {
    if (!await authorizeExperience(x.merchantId, x.experienceId)) return { error: 'Experience unavailable.' };
    const client = await createClient();
    const { data, error } = await client.from('experience_schedules').delete()
      .eq('id', x.scheduleId).eq('experience_id', x.experienceId).select('id');
    if (error || data?.length !== 1) return unavailable;
    refresh(x.merchantId, 'experiences', x.experienceId);
    return { ok: true };
  } catch { return unavailable; }
}

const vibeInput = experienceChild.extend({ vibeId: uuid });
export async function setExperienceVibe(input: unknown, enabled: boolean): Promise<MerchantResult> {
  const parsed = vibeInput.safeParse(input);
  if (!parsed.success || typeof enabled !== 'boolean') return invalid;
  const x = parsed.data;
  try {
    if (!await authorizeExperience(x.merchantId, x.experienceId)) return { error: 'Experience unavailable.' };
    const client = await createClient();
    const result = enabled
      ? await client.from('experience_vibes').upsert({ experience_id: x.experienceId, vibe_id: x.vibeId },
          { onConflict: 'experience_id,vibe_id', ignoreDuplicates: true })
      : await client.from('experience_vibes').delete().eq('experience_id', x.experienceId).eq('vibe_id', x.vibeId);
    if (result.error) return unavailable;
    refresh(x.merchantId, 'experiences', x.experienceId);
    return { ok: true };
  } catch { return unavailable; }
}
