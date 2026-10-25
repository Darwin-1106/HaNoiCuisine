// Dish schemas: Zod validation for request input
import { z } from 'zod';

const slug = z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const listDishesQuery = z.object({
    season: slug.optional(),
    tag: slug.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListDishesQuery = z.infer<typeof listDishesQuery>;
