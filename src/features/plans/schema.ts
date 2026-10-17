import { z } from 'zod';

export const uuid = z.string().uuid();
export const shareId = z.string().regex(/^[a-f0-9]{64}$/);
export const planInput = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime({ offset: true }).nullable(),
}).strict();
export const favoriteInput = z.object({ experienceId: uuid, saved: z.boolean() }).strict();
export const itemInput = z.object({ planId: uuid, experienceId: uuid }).strict();
export const joinInput = z.object({ shareId, nickname: z.string().trim().min(1).max(40).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value), 'Remove control characters from the nickname.') }).strict();
export const voteInput = z.object({ shareId, itemId: uuid, vote: z.enum(['yes', 'maybe', 'no']) }).strict();
