'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { favoriteInput, itemInput, joinInput, planInput, shareId, uuid, voteInput } from './schema';

type Result = { ok: true; id?: string } | { error: string };
const invalid = { error: 'Check the details and try again.' } as const;
async function owner(planId: string, userId: string) {
  const client = await createClient();
  const { data } = await client.from('plans').select('id').eq('id', planId).eq('owner_id', userId).maybeSingle();
  return !!data;
}

export async function setFavorite(input: unknown): Promise<Result> {
  const parsed = favoriteInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    await requireAuthenticatedUser();
    const client = await createClient();
    const { error } = parsed.data.saved
      ? await client.from('favorites').upsert({ experience_id: parsed.data.experienceId }, { onConflict: 'user_id,experience_id', ignoreDuplicates: true })
      : await client.from('favorites').delete().eq('experience_id', parsed.data.experienceId);
    if (error) return { error: 'This experience cannot be saved right now.' };
    revalidatePath('/favorites'); revalidatePath('/discover');
    return { ok: true };
  } catch { return { error: 'Sign in to manage favorites.' }; }
}

export async function createPlan(input: unknown): Promise<Result> {
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    await requireAuthenticatedUser();
    const client = await createClient();
    const { data, error } = await client.from('plans').insert({ title: parsed.data.title, starts_at: parsed.data.startsAt }).select('id').single();
    if (error || !data) return { error: 'Unable to create plan.' };
    revalidatePath('/plans');
    return { ok: true, id: data.id };
  } catch { return { error: 'Sign in to create a plan.' }; }
}

export async function updatePlan(input: unknown): Promise<Result> {
  const parsed = planInput.extend({ id: uuid }).safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const user = await requireAuthenticatedUser();
    if (!await owner(parsed.data.id, user.id)) return { error: 'Plan unavailable.' };
    const client = await createClient();
    const { error } = await client.from('plans').update({ title: parsed.data.title, starts_at: parsed.data.startsAt }).eq('id', parsed.data.id).eq('owner_id', user.id);
    if (error) return { error: 'Unable to update plan.' };
    revalidatePath(`/plans/${parsed.data.id}`); return { ok: true };
  } catch { return { error: 'Unable to update plan.' }; }
}

export async function deletePlan(input: unknown): Promise<Result> {
  const parsed = uuid.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const user = await requireAuthenticatedUser();
    const client = await createClient();
    const { data, error } = await client.from('plans').delete().eq('id', parsed.data).eq('owner_id', user.id).select('id');
    if (error || !data?.length) return { error: 'Plan unavailable.' };
    revalidatePath('/plans'); return { ok: true };
  } catch { return { error: 'Unable to delete plan.' }; }
}

export async function setPlanItem(input: unknown): Promise<Result> {
  const parsed = itemInput.extend({ add: z.boolean() }).safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const user = await requireAuthenticatedUser();
    if (!await owner(parsed.data.planId, user.id)) return { error: 'Plan unavailable.' };
    const client = await createClient();
    const { error } = parsed.data.add
      ? await client.from('plan_items').upsert({ plan_id: parsed.data.planId, experience_id: parsed.data.experienceId }, { onConflict: 'plan_id,experience_id', ignoreDuplicates: true })
      : await client.from('plan_items').delete().eq('plan_id', parsed.data.planId).eq('experience_id', parsed.data.experienceId);
    if (error) return { error: 'Unable to change plan items.' };
    revalidatePath(`/plans/${parsed.data.planId}`); return { ok: true };
  } catch { return { error: 'Unable to change plan items.' }; }
}

export async function setPlanSharing(input: unknown): Promise<Result> {
  const parsed = uuid.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const user = await requireAuthenticatedUser();
    if (!await owner(parsed.data, user.id)) return { error: 'Plan unavailable.' };
    const client = await createClient();
    const { data, error: readError } = await client.from('plans').select('status').eq('id', parsed.data).single();
    if (readError) return { error: 'Plan unavailable.' };
    const status = data.status === 'shared' ? 'draft' : 'shared';
    const { error } = await client.from('plans').update({ status }).eq('id', parsed.data).eq('owner_id', user.id);
    if (error) return { error: 'Unable to change sharing.' };
    revalidatePath(`/plans/${parsed.data}`); return { ok: true };
  } catch { return { error: 'Unable to change sharing.' }; }
}

export async function rotateShareLink(input: unknown): Promise<Result> {
  const parsed = uuid.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    await requireAuthenticatedUser();
    const client = await createClient();
    const { error } = await client.rpc('rotate_plan_share_id', { p_plan_id: parsed.data });
    if (error) return { error: 'Unable to replace share link.' };
    revalidatePath(`/plans/${parsed.data}`); return { ok: true };
  } catch { return { error: 'Unable to replace share link.' }; }
}

export async function joinPlan(input: unknown): Promise<Result> {
  const parsed = joinInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('join_shared_plan', { p_share_id: parsed.data.shareId, p_nickname: parsed.data.nickname });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return { error: 'This plan is not open to join.' };
    const token = shareId.safeParse((data as Record<string, unknown>).participant_token);
    if (!token.success) return { error: 'Unable to save participation.' };
    (await cookies()).set(`khi_plan_${parsed.data.shareId}`, token.data, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: `/plans/share/${parsed.data.shareId}`, maxAge: 60 * 60 * 24 * 30 });
    revalidatePath(`/plans/share/${parsed.data.shareId}`); return { ok: true };
  } catch { return { error: 'Unable to join plan.' }; }
}

export async function voteOnPlan(input: unknown): Promise<Result> {
  const parsed = voteInput.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const token = (await cookies()).get(`khi_plan_${parsed.data.shareId}`)?.value;
    if (!shareId.safeParse(token).success) return { error: 'Join this plan before voting.' };
    const client = await createClient();
    const { error } = await client.rpc('cast_plan_vote', { p_share_id: parsed.data.shareId, p_participant_token: token!, p_item_id: parsed.data.itemId, p_vote: parsed.data.vote });
    if (error) return { error: 'Vote unavailable. The plan or participation may have changed.' };
    revalidatePath(`/plans/share/${parsed.data.shareId}`); return { ok: true };
  } catch { return { error: 'Vote unavailable.' }; }
}
