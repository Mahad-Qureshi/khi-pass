import { z } from 'zod';

export const uuid = z.string().uuid();
export const redemptionCode = z.string().trim().regex(/^KHI-[A-F0-9]{32}$/i).transform(value => value.toUpperCase());
export const claimInput = z.object({ dropId: uuid, requestId: uuid }).strict();
export const redeemInput = z.object({ code: redemptionCode }).strict();

export const pass = z.object({
  id: uuid, drop_id: uuid, merchant_id: uuid, venue_id: uuid.nullable(),
  status: z.enum(['pending', 'redeemed', 'expired', 'cancelled']),
  redemption_code: redemptionCode.nullable(),
  claimed_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  redeemed_at: z.string().datetime({ offset: true }).nullable(),
  cancelled_at: z.string().datetime({ offset: true }).nullable(),
  price: z.number().nonnegative(), terms: z.string(),
  title: z.string().nullable(), merchant_name: z.string().nullable(), venue_name: z.string().nullable(),
});
export type Pass = z.infer<typeof pass>;
export const passList = z.object({ items: z.array(pass), total: z.number().int().nonnegative() });
