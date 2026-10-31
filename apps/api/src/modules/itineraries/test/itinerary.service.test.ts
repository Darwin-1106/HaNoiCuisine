// Itinerary service tests: stop count mapping, paging and hiding unpublished restaurants with Prisma mocked
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getItineraryBySlug, listItineraries } from '../services/itinerary.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        itinerary: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.itinerary);

describe('listItineraries', () => {
    it('renames _count to stopCount and computes the page offset', async () => {
        db.findMany.mockResolvedValue([{ title: 'Lộ trình', slug: 'lo-trinh', _count: { stops: 4 } }] as never);
        db.count.mockResolvedValue(1);

        const result = await listItineraries({ page: 2, limit: 5 });

        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
        expect(result).toEqual({
            items: [{ title: 'Lộ trình', slug: 'lo-trinh', stopCount: 4 }],
            total: 1,
            page: 2,
            limit: 5,
        });
    });
});

describe('getItineraryBySlug', () => {
    it('returns null when the itinerary does not exist', async () => {
        db.findUnique.mockResolvedValue(null);

        expect(await getItineraryBySlug('khong-co')).toBeNull();
    });

    it('hides unpublished restaurants and drops the published flag', async () => {
        db.findUnique.mockResolvedValue({
            title: 'Lộ trình',
            stops: [
                { orderNo: 1, restaurant: { name: 'Quán mở', published: true } },
                { orderNo: 2, restaurant: { name: 'Quán ẩn', published: false } },
                { orderNo: 3, restaurant: null },
            ],
        } as never);

        const result = await getItineraryBySlug('lo-trinh');

        expect(result?.stops).toEqual([
            { orderNo: 1, restaurant: { name: 'Quán mở' } },
            { orderNo: 2, restaurant: null },
            { orderNo: 3, restaurant: null },
        ]);
    });
});
