// Validate pagination for the admin article list
import { z } from 'zod';

export const listAdminArticlesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListAdminArticlesQuery = z.infer<typeof listAdminArticlesQuery>;
