// Season service tests: Prisma queries and the _count to dishCount mapping with Prisma mocked
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getSeasonBySlug, listSeasons } from '../services/season.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        season: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.season);

describe('listSeasons', () => {
    it('orders seasons by id so they follow the calendar', async () => {
        db.findMany.mockResolvedValue([]);

        await listSeasons();

        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { id: 'asc' } }));
    });

    it('replaces the Prisma _count field with dishCount', async () => {
        db.findMany.mockResolvedValue([{ name: 'Đông', slug: 'dong', _count: { dishes: 3 } }] as never);

        const result = await listSeasons();

        expect(result).toEqual([{ name: 'Đông', slug: 'dong', dishCount: 3 }]);
    });
});

describe('getSeasonBySlug', () => {
    it('looks up the season by its unique slug', async () => {
        db.findUnique.mockResolvedValue(null);

        await getSeasonBySlug('dong');

        expect(db.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'dong' } }));
    });

    it('lists the dishes of the season sorted by dish name', async () => {
        db.findUnique.mockResolvedValue(null);

        await getSeasonBySlug('dong');

        const args = db.findUnique.mock.calls[0][0];
        expect(args.select?.dishes).toMatchObject({ orderBy: { dish: { name: 'asc' } } });
    });
});
