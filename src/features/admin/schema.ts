import { z } from 'zod';

export const adminId = z.string().uuid();
export const merchantInput = z.object({
  businessName: z.string().trim().min(1).max(160),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  businessType: z.string().trim().min(1).max(80),
  ownerId: adminId,
});
export const memberInput = z.object({ merchantId: adminId, userId: adminId,
  role: z.enum(['owner', 'manager', 'staff']), });
export const moderationKind = z.enum(['merchant', 'venue', 'experience', 'drop']);
export const moderationInput = z.object({ kind: moderationKind, id: adminId,
  status: z.string().max(32), reason: z.string().trim().max(2000), });

export const transitions: Record<z.infer<typeof moderationKind>, Record<string, string[]>> = {
  merchant: { pending: ['approved', 'rejected'], approved: ['suspended'], suspended: ['approved'], rejected: ['pending'] },
  venue: { draft: ['published', 'rejected'], pending_approval: ['published', 'rejected'], rejected: ['draft'], published: ['archived'] },
  experience: { draft: ['published', 'rejected'], pending_approval: ['published', 'rejected'], rejected: ['draft'], published: ['archived'] },
  drop: { draft: ['scheduled', 'active', 'rejected', 'paused'], pending_approval: ['scheduled', 'active', 'rejected', 'paused'], rejected: ['draft'],
    scheduled: ['paused'], active: ['paused'], sold_out: ['paused'], paused: ['scheduled', 'active'] },
};
