// Validate admin itinerary queries, IDs, and writes
import { z } from 'zod';

export const listAdminItinerariesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    q: z.string().trim().min(1).max(100).optional(),
});

export const adminItineraryParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export type ListAdminItinerariesQuery = z.infer<typeof listAdminItinerariesQuery>;

const itineraryStop = z
    .strictObject({
        timeSlot: z.enum(['MORNING', 'NOON', 'AFTERNOON', 'EVENING']),
        restaurantId: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
        dishId: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
        note: z.string().trim().min(1).max(500).nullable().optional(),
    })
    .refine((stop) => stop.restaurantId != null || stop.dishId != null, {
        message: 'Điểm dừng cần có nhà hàng hoặc món ăn',
    });

export const createAdminItineraryBody = z.strictObject({
    title: z.string().trim().min(1).max(250),
    slug: z
        .string()
        .trim()
        .max(270)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(1).max(10_000).nullable().optional(),
    stops: z.array(itineraryStop).max(50).default([]),
});

export const updateAdminItineraryBody = createAdminItineraryBody
    .extend({ stops: z.array(itineraryStop).max(50) })
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Cần gửi ít nhất một trường để cập nhật' });

export type CreateAdminItineraryBody = z.infer<typeof createAdminItineraryBody>;
export type UpdateAdminItineraryBody = z.infer<typeof updateAdminItineraryBody>;
