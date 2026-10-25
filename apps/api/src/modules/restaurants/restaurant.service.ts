// Restaurant service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ListRestaurantsQuery } from './restaurant.schema.js';

export async function listRestaurants(query: ListRestaurantsQuery) {
    const { district, dish, q, maxPrice, page, limit } = query;

    const where: Prisma.RestaurantWhereInput = {
        published: true,
        ...(district && { district: { slug: district } }),
        ...(dish && { dishes: { some: { dish: { slug: dish } } } }),
        ...(q && { OR: [{ name: { contains: q } }, { address: { contains: q } }] }),
        ...(maxPrice && { priceMin: { lte: maxPrice } }),
    };

    const [items, total] = await Promise.all([
        prisma.restaurant.findMany({
            where,
            include: { district: true, dishes: { include: { dish: true } } },
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.restaurant.count({ where }),
    ]);

    return { items, total, page, limit };
}

export function getRestaurantBySlug(slug: string) {
    return prisma.restaurant.findFirst({
        where: { slug, published: true },
        include: {
            district: true,
            dishes: { include: { dish: true } },
            reviews: {
                orderBy: { createdAt: 'desc' },
                select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
            },
        },
    });
}
