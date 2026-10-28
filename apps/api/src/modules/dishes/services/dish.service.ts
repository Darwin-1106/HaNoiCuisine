// Dish service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListDishesQuery } from '../schemas/dish.schema.js';

const seasonSelect = {
    bestMonths: true,
    season: { select: { name: true, slug: true } },
} satisfies Prisma.DishSeasonSelect;

const dishSummarySelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    image: true,
    seasons: { select: seasonSelect },
} satisfies Prisma.DishSelect;

const dishDetailSelect = {
    ...dishSummarySelect,
    originStory: true,
    tags: { select: { tag: { select: { name: true, slug: true } } } },
    restaurants: {
        where: { restaurant: { published: true } },
        orderBy: { restaurant: { name: 'asc' } },
        select: {
            signature: true,
            restaurant: {
                select: {
                    name: true,
                    slug: true,
                    address: true,
                    priceMin: true,
                    priceMax: true,
                    district: { select: { name: true, slug: true } },
                },
            },
        },
    },
    recipes: {
        orderBy: { title: 'asc' },
        select: { title: true, slug: true, difficulty: true, cookMinutes: true, servings: true },
    },
} satisfies Prisma.DishSelect;

export async function listDishes(query: ListDishesQuery) {
    const { season, tag, q, page, limit } = query;

    const where: Prisma.DishWhereInput = {
        ...(season && { seasons: { some: { season: { slug: season } } } }),
        ...(tag && { tags: { some: { tag: { slug: tag } } } }),
        ...(q && { OR: [{ name: { contains: q } }, { description: { contains: q } }] }),
    };

    const [items, total] = await Promise.all([
        prisma.dish.findMany({
            where,
            select: dishSummarySelect,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.dish.count({ where }),
    ]);
    return { items, total, page, limit };
}

export function getDishBySlug(slug: string) {
    return prisma.dish.findUnique({
        where: { slug },
        select: dishDetailSelect,
    });
}
