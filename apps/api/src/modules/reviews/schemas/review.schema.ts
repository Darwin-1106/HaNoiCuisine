// Review schemas: validate restaurant slugs and new review input
import { z } from 'zod';

export const reviewParams = z.object({
    slug: z
        .string()
        .trim()
        .max(220)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const createReviewBody = z.strictObject({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(2000).optional(),
});

export type CreateReviewBody = z.infer<typeof createReviewBody>;
