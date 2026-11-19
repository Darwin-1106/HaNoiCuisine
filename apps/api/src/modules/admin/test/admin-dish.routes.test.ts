// Verify admin dish reads through the router with Prisma mocked
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        dish: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.dish);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const path = '/api/v1/admin/dishes';
const listSelect = { id: true, name: true, slug: true, image: true };
const detailSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    originStory: true,
    image: true,
    seasons: {
        orderBy: { seasonId: 'asc' },
        select: { bestMonths: true, season: { select: { id: true, name: true, slug: true } } },
    },
    _count: { select: { restaurants: true } },
};

function expectNoQuery() {
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.count).not.toHaveBeenCalled();
    expect(db.findUnique).not.toHaveBeenCalled();
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('GET /api/v1/admin/dishes', () => {
    it('lists dishes with default pagination ordered by name then id without caching', async () => {
        const items = [
            { id: 2, name: 'Bún chả', slug: 'bun-cha', image: null },
            { id: 1, name: 'Phở bò', slug: 'pho-bo', image: 'https://example.com/pho.jpg' },
        ];
        db.findMany.mockResolvedValue(items as never);
        db.count.mockResolvedValue(2);

        const res = await request(app).get(path).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ items, total: 2, page: 1, limit: 12 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            where: {},
            select: listSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: 0,
            take: 12,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith({ where: {} });
    });

    it('filters by a trimmed name search on the requested page', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(5);

        const res = await request(app).get(path).query({ q: '  phở ', page: 3, limit: 2 }).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 5, page: 3, limit: 2 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            where: { name: { contains: 'phở' } },
            select: listSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: 4,
            take: 2,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith({ where: { name: { contains: 'phở' } } });
    });

    it.each([
        'page=0',
        'page=10001',
        'limit=0',
        'limit=51',
        'page=abc',
        'q=',
        'q=%20%20',
        `q=${'a'.repeat(101)}`,
        'q[]=a',
    ])('rejects invalid query %s', async (query) => {
        const res = await request(app)
            .get(path + '?' + query)
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expectNoQuery();
    });

    it('rejects unauthenticated requests before querying dishes', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(lookup).not.toHaveBeenCalled();
        expectNoQuery();
    });

    it('rejects regular users before querying dishes', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app).get(path).set('Cookie', cookie);

        expect(res.status).toBe(403);
        expectNoQuery();
    });

    it('returns a generic server error when the query fails', async () => {
        db.findMany.mockRejectedValue(new Error('Private database error'));
        db.count.mockResolvedValue(0);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app).get(path).set('Cookie', cookie);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('GET /api/v1/admin/dishes/:id', () => {
    it('returns a dish with its seasons and restaurant count without caching', async () => {
        const seasons = [{ bestMonths: '10-12', season: { id: 4, name: 'Mùa đông', slug: 'mua-dong' } }];
        db.findUnique.mockResolvedValue({
            id: 5,
            name: 'Phở bò',
            slug: 'pho-bo',
            description: 'Món nước',
            originStory: null,
            image: null,
            seasons,
            _count: { restaurants: 3 },
        } as never);

        const res = await request(app)
            .get(path + '/5')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({
            dish: {
                id: 5,
                name: 'Phở bò',
                slug: 'pho-bo',
                description: 'Món nước',
                originStory: null,
                image: null,
                seasons,
                restaurantCount: 3,
            },
        });
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 5 }, select: detailSelect });
    });

    it('returns 404 when the dish does not exist', async () => {
        db.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get(path + '/2147483647')
            .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy món ăn' });
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 2_147_483_647 }, select: detailSelect });
    });

    it.each(['0', '-1', '01', '1.5', 'abc', '2147483648'])('rejects invalid id %s', async (id) => {
        const res = await request(app)
            .get(path + '/' + id)
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expectNoQuery();
    });

    it('rejects unauthenticated requests before querying the dish', async () => {
        const res = await request(app).get(path + '/5');

        expect(res.status).toBe(401);
        expectNoQuery();
    });

    it('rejects regular users before querying the dish', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app)
            .get(path + '/5')
            .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expectNoQuery();
    });

    it('returns a generic server error when the lookup fails', async () => {
        db.findUnique.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app)
            .get(path + '/5')
            .set('Cookie', cookie);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
