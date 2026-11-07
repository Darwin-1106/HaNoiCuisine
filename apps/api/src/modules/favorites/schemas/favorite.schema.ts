// Favorite schemas: validate restaurant slugs and pagination
import { z } from 'zod';

export const favoriteParams = z.object({
    slug: z
        .string()
        .trim()
        .max(220)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const listFavoritesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuery>;
