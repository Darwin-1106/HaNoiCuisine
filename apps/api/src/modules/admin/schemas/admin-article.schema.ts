// Validate admin article queries and writes
import { z } from 'zod';

export const listAdminArticlesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListAdminArticlesQuery = z.infer<typeof listAdminArticlesQuery>;

export const adminArticleParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export const createAdminArticleBody = z.strictObject({
    title: z.string().trim().min(1).max(250),
    slug: z
        .string()
        .max(270)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    summary: z.string().trim().min(1).max(500).nullable().optional(),
    contentMd: z
        .string()
        .max(50_000)
        .refine((value) => value.trim().length > 0),
});

export const updateAdminArticleBody = createAdminArticleBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Cần gửi ít nhất một trường để cập nhật' });

export type CreateAdminArticleBody = z.infer<typeof createAdminArticleBody>;
export type UpdateAdminArticleBody = z.infer<typeof updateAdminArticleBody>;
