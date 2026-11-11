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

export const createAdminRestaurantBody = z.strictObject({
    name: z.string().trim().min(1).max(200),
    slug: z
        .string()
        .trim()
        .max(220)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    address: z.string().trim().min(1).max(300),
    districtId: z.number().int().positive().max(2_147_483_647),
    openHours: z.string().trim().min(1).max(200).nullable().optional(),
    phone: z.string().trim().min(1).max(30).nullable().optional(),
    description: z.string().trim().min(1).max(5_000).nullable().optional(),
});

export const updateAdminRestaurantBody = createAdminRestaurantBody
    .partial()
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
        message: 'Cần gửi ít nhất một trường để cập nhật',
    });

export type CreateAdminRestaurantBody = z.infer<typeof createAdminRestaurantBody>;
export type UpdateAdminRestaurantBody = z.infer<typeof updateAdminRestaurantBody>;
