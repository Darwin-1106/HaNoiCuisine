// Validate admin restaurant pagination, IDs, and visibility updates
import { z } from 'zod';

export const listAdminRestaurantsQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const adminRestaurantParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export const restaurantVisibilityBody = z.strictObject({ published: z.boolean() });

export type ListAdminRestaurantsQuery = z.infer<typeof listAdminRestaurantsQuery>;
