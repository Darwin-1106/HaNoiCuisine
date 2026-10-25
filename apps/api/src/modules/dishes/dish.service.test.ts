// Dish service tests: Prisma query building (filters, paging, published-only restaurants) with Prisma mocked
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDishBySlug, listDishes } from './dish.service.js';

vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        dish: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.dish);

describe('listDishes', () => {
    it('applies no filter when none is given', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listDishes({ page: 1, limit: 12 });

        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 12 }));
        expect(db.count).toHaveBeenCalledWith({ where: {} });
    });

    it('combines season, tag and keyword filters and computes the page offset', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listDishes({ season: 'dong', tag: 'mon-nuoc', q: 'pho', page: 2, limit: 6 });

        const where = {
            seasons: { some: { season: { slug: 'dong' } } },
            tags: { some: { tag: { slug: 'mon-nuoc' } } },
            OR: [{ name: { contains: 'pho' } }, { description: { contains: 'pho' } }],
        };
        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 6, take: 6 }));
        expect(db.count).toHaveBeenCalledWith({ where });
    });

    it('returns items with total and paging info', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(7);

        const result = await listDishes({ page: 1, limit: 12 });

        expect(result).toEqual({ items: [], total: 7, page: 1, limit: 12 });
    });
});

describe('getDishBySlug', () => {
    it('looks up the dish by its unique slug', async () => {
        db.findUnique.mockResolvedValue(null);

        await getDishBySlug('pho-bo');

        expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'pho-bo' } }));
    });

    it('only lists restaurants that are published', async () => {
        db.findUnique.mockResolvedValue(null);

        await getDishBySlug('pho-bo');

        const args = db.findUnique.mock.calls[0][0];
        expect(args.select?.restaurants).toMatchObject({ where: { restaurant: { published: true } } });
    });
});
