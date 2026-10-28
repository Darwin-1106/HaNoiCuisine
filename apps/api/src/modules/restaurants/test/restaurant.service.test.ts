// Restaurant service tests: Prisma query building (filters, paging, privacy) with Prisma mocked
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getRestaurantBySlug, listRestaurants } from '../services/restaurant.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        restaurant: {
            findMany: vi.fn(),
            count: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.restaurant);

describe('listRestaurants', () => {
    it('only returns published restaurants when no filter is given', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listRestaurants({ page: 1, limit: 12 });

        expect(db.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { published: true }, skip: 0, take: 12 }),
        );
        expect(db.count).toHaveBeenCalledWith({ where: { published: true } });
    });

    it('combines every filter and computes the page offset', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listRestaurants({ district: 'hoan-kiem', dish: 'pho-bo', q: 'pho', maxPrice: 60000, page: 3, limit: 5 });

        const where = {
            published: true,
            district: { slug: 'hoan-kiem' },
            dishes: { some: { dish: { slug: 'pho-bo' } } },
            OR: [{ name: { contains: 'pho' } }, { address: { contains: 'pho' } }],
            priceMin: { lte: 60000 },
        };
        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 5 }));
        expect(db.count).toHaveBeenCalledWith({ where });
    });

    it('returns items with total and paging info', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(42);

        const result = await listRestaurants({ page: 2, limit: 10 });

        expect(result).toEqual({ items: [], total: 42, page: 2, limit: 10 });
    });
});

describe('getRestaurantBySlug', () => {
    it('looks up a published restaurant by slug', async () => {
        db.findFirst.mockResolvedValue(null);

        await getRestaurantBySlug('pho-thin');

        expect(db.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { slug: 'pho-thin', published: true } }),
        );
    });

    it('never selects reviewer data other than the name', async () => {
        db.findFirst.mockResolvedValue(null);

        await getRestaurantBySlug('pho-thin');

        const args = db.findFirst.mock.calls[0][0];
        expect(args?.include?.reviews).toMatchObject({ select: { user: { select: { name: true } } } });
    });
});
