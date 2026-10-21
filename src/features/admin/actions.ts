'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './data';
import { merchantInput, memberInput, moderationInput, transitions } from './schema';

export type AdminResult = { ok: true; id?: string } | { error: string };

export async function createMerchant(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = merchantInput.safeParse(input);
  if (!parsed.success) return { error: 'Check the business name, slug, type and owner.' };
  try {
    const client = await createClient();
    const x = parsed.data;
    // The RPC inserts the business and owner membership in one transaction.
    const { data, error } = await client.rpc('admin_create_merchant', {
      p_business_name: x.businessName, p_slug: x.slug, p_business_type: x.businessType, p_owner_id: x.ownerId,
    });
    if (error) return { error: error.code === '23505' ? 'This slug is already in use.' :
      error.code === '23503' ? 'Choose an existing registered owner.' : 'Unable to create merchant.' };
    revalidatePath('/admin'); revalidatePath('/admin/merchants');
    return { ok: true, id: data };
  } catch { return { error: 'Unable to create merchant. Try again.' }; }
}

export async function assignMember(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = memberInput.safeParse(input);
  if (!parsed.success) return { error: 'Choose a valid registered user and role.' };
  try {
    const client = await createClient();
    const x = parsed.data;
    const { error } = await client.rpc('admin_set_merchant_member', {
      p_merchant_id: x.merchantId, p_user_id: x.userId, p_role: x.role,
    });
    if (error) return { error: error.code === '23503' ? 'Choose an existing registered user.' : 'Unable to assign member.' };
    revalidatePath(`/admin/merchants/${x.merchantId}`);
    return { ok: true };
  } catch { return { error: 'Unable to assign member. Try again.' }; }
}

export async function moderate(input: unknown): Promise<AdminResult> {
  await requireAdmin();
  const parsed = moderationInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid moderation request.' };
  try {
    const client = await createClient();
    const x = parsed.data;
    const table = ({ merchant: 'merchants', venue: 'venues', experience: 'experiences', drop: 'drops' } as const)[x.kind];
    const { data, error: readError } = await client.from(table).select('status').eq('id', x.id).maybeSingle();
    if (readError || !data) return { error: 'Content unavailable.' };
    if (!transitions[x.kind][data.status]?.includes(x.status)) return { error: 'This status change is unavailable.' };
    const { error } = await client.rpc('admin_moderate_content', {
      p_kind: x.kind, p_id: x.id, p_status: x.status, p_reason: x.reason || undefined,
    });
    if (error) return { error: 'Status change denied or unavailable.' };
    revalidatePath('/admin'); revalidatePath(`/admin/${table}`); revalidatePath(`/admin/${table}/${x.id}`);
    return { ok: true };
  } catch { return { error: 'Unable to change status. Try again.' }; }
}
