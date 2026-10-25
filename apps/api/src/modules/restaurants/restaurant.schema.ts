// Restaurant schemas: Zod validation for request input
import { z } from 'zod';

export const listRestaurantsQuery = z.object({
    district: z.string().optional(),
    dish: z.string().optional(),
    q: z.string().trim().min(1).optional(),
    maxPrice: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListRestaurantsQuery = z.infer<typeof listRestaurantsQuery>;
