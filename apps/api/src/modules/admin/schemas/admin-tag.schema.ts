// Validate admin tag queries, IDs, and writes
import { z } from 'zod';

export const listAdminTagsQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    q: z.string().trim().min(1).max(100).optional(),
});

export const adminTagParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export const createAdminTagBody = z.strictObject({
    name: z.string().trim().min(1).max(100),
    slug: z
        .string()
        .trim()
        .max(120)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const updateAdminTagBody = createAdminTagBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Cần gửi ít nhất một trường để cập nhật' });

export type ListAdminTagsQuery = z.infer<typeof listAdminTagsQuery>;
export type CreateAdminTagBody = z.infer<typeof createAdminTagBody>;
export type UpdateAdminTagBody = z.infer<typeof updateAdminTagBody>;
