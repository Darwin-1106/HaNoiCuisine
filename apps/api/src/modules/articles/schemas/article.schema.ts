// Article schemas: Zod validation for request input
import { z } from 'zod';

export const listArticlesQuery = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuery>;
