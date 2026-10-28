// Season service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';

const seasonDishSelect = {
    bestMonths: true,
    dish: { select: { name: true, slug: true, description: true, image: true } },
} satisfies Prisma.DishSeasonSelect;

export async function listSeasons() {
    const seasons = await prisma.season.findMany({
        orderBy: { id: 'asc' },
        select: { name: true, slug: true, _count: { select: { dishes: true } } },
    });
    return seasons.map(({ _count, ...season }) => ({ ...season, dishCount: _count.dishes }));
}

export function getSeasonBySlug(slug: string) {
    return prisma.season.findUnique({
        where: { slug },
        select: {
            name: true,
            slug: true,
            dishes: { orderBy: { dish: { name: 'asc' } }, select: seasonDishSelect },
        },
    });
}
