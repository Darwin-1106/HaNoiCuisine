// Recipe service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import { recipeSteps, type ListRecipesQuery } from '../schemas/recipe.schema.js';

const recipeSummarySelect = {
    title: true,
    slug: true,
    servings: true,
    cookMinutes: true,
    difficulty: true,
    image: true,
    dish: { select: { name: true, slug: true } },
} satisfies Prisma.RecipeSelect;

const recipeDetailSelect = {
    ...recipeSummarySelect,
    stepsJson: true,
    ingredients: { orderBy: { id: 'asc' }, select: { name: true, quantity: true, unit: true } },
} satisfies Prisma.RecipeSelect;

export async function listRecipes(query: ListRecipesQuery) {
    const { dish, difficulty, page, limit } = query;

    const where: Prisma.RecipeWhereInput = {
        ...(dish && { dish: { slug: dish } }),
        ...(difficulty && { difficulty }),
    };

    const [items, total] = await Promise.all([
        prisma.recipe.findMany({
            where,
            select: recipeSummarySelect,
            orderBy: { title: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.recipe.count({ where }),
    ]);

    return { items, total, page, limit };
}

export async function getRecipeBySlug(slug: string) {
    const recipe = await prisma.recipe.findUnique({
        where: { slug },
        select: recipeDetailSelect,
    });
    if (!recipe) {
        return null;
    }

    const { stepsJson, ...rest } = recipe;
    return { ...rest, steps: recipeSteps.parse(stepsJson) };
}
