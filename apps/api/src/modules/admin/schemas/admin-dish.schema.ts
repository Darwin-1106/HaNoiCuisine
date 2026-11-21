// Validate admin dish queries, IDs, and writes
import { z } from 'zod';

export const listAdminDishesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    q: z.string().trim().min(1).max(100).optional(),
});

export const adminDishParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export const adminDishSeasonParams = adminDishParams.extend({
    seasonId: adminDishParams.shape.id,
});

export const saveAdminDishSeasonBody = z.strictObject({
    bestMonths: z.string().trim().min(1).max(50).nullable(),
});

export type SaveAdminDishSeasonBody = z.infer<typeof saveAdminDishSeasonBody>;

export type ListAdminDishesQuery = z.infer<typeof listAdminDishesQuery>;

export const createAdminDishBody = z.strictObject({
    name: z.string().trim().min(1).max(200),
    slug: z
        .string()
        .trim()
        .max(220)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(1).max(5_000).nullable().optional(),
    originStory: z.string().trim().min(1).max(10_000).nullable().optional(),
});

export const updateAdminDishBody = createAdminDishBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Cần gửi ít nhất một trường để cập nhật' });

export type CreateAdminDishBody = z.infer<typeof createAdminDishBody>;
export type UpdateAdminDishBody = z.infer<typeof updateAdminDishBody>;
