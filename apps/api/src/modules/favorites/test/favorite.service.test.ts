// Favorite service tests: account isolation, visibility and repeatable writes
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { listFavorites, removeFavorite, saveFavorite } from '../services/favorite.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        restaurant: { findFirst: vi.fn() },
        favorite: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    },
}));

const restaurants = vi.mocked(prisma.restaurant);
const favorites = vi.mocked(prisma.favorite);

function prismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Favorite write failed', { code, clientVersion: 'test' });
}

describe('Favorites service', () => {
    it('only saves published restaurants and skips the write if none matches', async () => {
        restaurants.findFirst.mockResolvedValue(null);

        await expect(saveFavorite('pho-thin', 7)).resolves.toBe(false);
        expect(restaurants.findFirst).toHaveBeenCalledExactlyOnceWith({
            where: { slug: 'pho-thin', published: true },
            select: { id: true },
        });
        expect(favorites.create).not.toHaveBeenCalled();
    });

    it('keeps repeated saves successful when the composite key already exists', async () => {
        restaurants.findFirst.mockResolvedValue({ id: 3 } as never);
        favorites.create
            .mockResolvedValueOnce({ userId: 7, restaurantId: 3 })
            .mockRejectedValueOnce(prismaError('P2002'));

        await expect(saveFavorite('pho-thin', 7)).resolves.toBe(true);
        await expect(saveFavorite('pho-thin', 7)).resolves.toBe(true);
        expect(favorites.create.mock.calls).toEqual([
            [{ data: { userId: 7, restaurantId: 3 } }],
            [{ data: { userId: 7, restaurantId: 3 } }],
        ]);
    });

    it('propagates database errors other than duplicates', async () => {
        restaurants.findFirst.mockResolvedValue({ id: 3 } as never);
        const error = prismaError('P2003');
        favorites.create.mockRejectedValue(error);

        await expect(saveFavorite('pho-thin', 7)).rejects.toBe(error);
    });

    it('removes only the caller favorite even for hidden or already removed restaurants', async () => {
        favorites.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

        await expect(removeFavorite('pho-thin', 7)).resolves.toBeUndefined();
        await expect(removeFavorite('pho-thin', 7)).resolves.toBeUndefined();
        expect(favorites.deleteMany.mock.calls).toEqual([
            [{ where: { userId: 7, restaurant: { slug: 'pho-thin' } } }],
            [{ where: { userId: 7, restaurant: { slug: 'pho-thin' } } }],
        ]);
    });

    it('uses the same account and visibility filter for the list and total', async () => {
        const restaurant = { id: 3, slug: 'pho-thin', name: 'Phở Thìn', address: 'Hà Nội', coverImage: null };
        favorites.findMany.mockResolvedValue([{ restaurant }] as never);
        favorites.count.mockResolvedValue(12);

        await expect(listFavorites(7, { page: 2, limit: 5 })).resolves.toEqual({
            items: [restaurant],
            total: 12,
            page: 2,
            limit: 5,
        });
        const where = { userId: 7, restaurant: { published: true } };
        expect(favorites.findMany).toHaveBeenCalledExactlyOnceWith({
            where,
            select: {
                restaurant: { select: { id: true, slug: true, name: true, address: true, coverImage: true } },
            },
            orderBy: { restaurantId: 'asc' },
            skip: 5,
            take: 5,
        });
        expect(favorites.count).toHaveBeenCalledExactlyOnceWith({ where });
    });
});
