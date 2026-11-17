// Validate pagination for the admin review list
import { z } from 'zod';

export const listAdminReviewsQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListAdminReviewsQuery = z.infer<typeof listAdminReviewsQuery>;
