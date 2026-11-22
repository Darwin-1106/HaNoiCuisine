// Read recipes for admins with their dish, ingredients, and raw steps
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListAdminRecipesQuery } from '../schemas/admin-recipe.schema.js';

const recipeListSelect = {
    id: true,
    title: true,
    slug: true,
    servings: true,
    cookMinutes: true,
    difficulty: true,
    image: true,
    dish: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.RecipeSelect;

const recipeDetailSelect = {
    ...recipeListSelect,
    stepsJson: true,
    ingredients: { orderBy: { id: 'asc' }, select: { id: true, name: true, quantity: true, unit: true } },
} satisfies Prisma.RecipeSelect;

export async function listAdminRecipes({ page, limit, q }: ListAdminRecipesQuery) {
    const where: Prisma.RecipeWhereInput = q ? { title: { contains: q } } : {};

    const [items, total] = await Promise.all([
        prisma.recipe.findMany({
            where,
            select: recipeListSelect,
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.recipe.count({ where }),
    ]);

    return { items, total, page, limit };
}

export async function getAdminRecipeById(id: number) {
    const recipe = await prisma.recipe.findUnique({ where: { id }, select: recipeDetailSelect });
    if (!recipe) {
        return null;
    }

    const { stepsJson, ...rest } = recipe;
    return { ...rest, steps: stepsJson };
}
