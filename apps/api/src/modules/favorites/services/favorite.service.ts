// Favorite service: manage saved restaurants for the authenticated user
import { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListFavoritesQuery } from '../schemas/favorite.schema.js';

export async function saveFavorite(slug: string, userId: number) {
    const restaurant = await prisma.restaurant.findFirst({
        where: { slug, published: true },
        select: { id: true },
    });

    if (!restaurant) {
        return false;
    }

    try {
        await prisma.favorite.create({
            data: { userId, restaurantId: restaurant.id },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return true;
        }

        throw error;
    }

    return true;
}

export async function removeFavorite(slug: string, userId: number) {
    await prisma.favorite.deleteMany({
        where: { userId, restaurant: { slug } },
    });
}

export async function listFavorites(userId: number, { page, limit }: ListFavoritesQuery) {
    const where = { userId, restaurant: { published: true } };

    const [favorites, total] = await Promise.all([
        prisma.favorite.findMany({
            where,
            select: {
                restaurant: {
                    select: { id: true, slug: true, name: true, address: true, coverImage: true },
                },
            },
            orderBy: { restaurantId: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.favorite.count({ where }),
    ]);

    return { items: favorites.map(({ restaurant }) => restaurant), total, page, limit };
}
