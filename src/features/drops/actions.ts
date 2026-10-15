'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { claimInput, redeemInput, uuid } from './pass-schema';

export type ClaimResult = { id: string } | { error: string };
export type RedeemResult = { redeemed: true } | { error: string };

export async function claimPass(input: unknown): Promise<ClaimResult> {
  const parsed = claimInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid claim request.' };
  try {
    if (!await getAuthenticatedUser()) return { error: 'Sign in to claim this PASS.' };
    const client = await createClient();
    const { data, error } = await client.rpc('claim_drop', { p_drop_id: parsed.data.dropId, p_request_id: parsed.data.requestId });
    if (error) {
      const messages: Record<string, string> = {
        DROP_SOLD_OUT: 'This PASS Drop is sold out.',
        DROP_NOT_CLAIMABLE: 'This PASS Drop is no longer available.',
        USER_CLAIM_LIMIT_REACHED: 'You have reached the claim limit for this Drop. Check My PASSes.',
      };
      return { error: messages[error.message] ?? 'Unable to claim this PASS. Please try again.' };
    }
    const id = uuid.safeParse((data as Record<string, unknown>)?.id);
    if (!id.success) return { error: 'Your claim may have succeeded. Check My PASSes.' };
    revalidatePath('/passes');
    return { id: id.data };
  } catch { return { error: 'Unable to claim this PASS. Please try again.' }; }
}

export async function redeemPass(input: unknown): Promise<RedeemResult> {
  const parsed = redeemInput.safeParse(input);
  if (!parsed.success) return { error: 'Enter a valid KHI PASS code.' };
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { error: 'Sign in with your merchant account.' };
    const client = await createClient();
    const { data: memberships, error: memberError } = await client.from('merchant_members')
      .select('merchant_id').eq('user_id', user.id).limit(1);
    if (memberError || !memberships?.length) return { error: 'Merchant access is required.' };
    const { error } = await client.rpc('redeem_drop_code', { p_code: parsed.data.code });
    if (error) return { error: 'This code cannot be redeemed. Check the code, expiry, and merchant account.' };
    return { redeemed: true };
  } catch { return { error: 'Redemption is unavailable. Please try again.' }; }
}
