// Validate admin recipe queries, IDs, and writes
import { z } from 'zod';

export const listAdminRecipesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    q: z.string().trim().min(1).max(100).optional(),
});

export const adminRecipeParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export type ListAdminRecipesQuery = z.infer<typeof listAdminRecipesQuery>;

const recipeIngredient = z.strictObject({
    name: z.string().trim().min(1).max(200),
    quantity: z.string().trim().min(1).max(50).nullable().optional(),
    unit: z.string().trim().min(1).max(50).nullable().optional(),
});

export const createAdminRecipeBody = z.strictObject({
    dishId: z.number().int().min(1).max(2_147_483_647),
    title: z.string().trim().min(1).max(250),
    slug: z
        .string()
        .trim()
        .max(270)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    servings: z.number().int().min(1).max(100).optional(),
    cookMinutes: z.number().int().min(1).max(10_080).nullable().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    steps: z.array(z.string().trim().min(1).max(2_000)).min(1).max(100),
    ingredients: z.array(recipeIngredient).max(100).default([]),
});

export const updateAdminRecipeBody = createAdminRecipeBody
    .extend({ ingredients: z.array(recipeIngredient).max(100) })
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Cần gửi ít nhất một trường để cập nhật' });

export type CreateAdminRecipeBody = z.infer<typeof createAdminRecipeBody>;
export type UpdateAdminRecipeBody = z.infer<typeof updateAdminRecipeBody>;
