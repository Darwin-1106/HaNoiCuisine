// Recipe schemas: Zod validation for request input and stored recipe steps
import { z } from 'zod';

const slug = z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const listRecipesQuery = z.object({
    dish: slug.optional(),
    difficulty: z
        .enum(['easy', 'medium', 'hard'])
        .transform((value) => value.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD')
        .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListRecipesQuery = z.infer<typeof listRecipesQuery>;

export const recipeSteps = z.array(z.string());
