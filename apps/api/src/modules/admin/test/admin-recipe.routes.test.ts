// Verify admin recipe reads through the router with Prisma mocked
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        recipe: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.recipe);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const path = '/api/v1/admin/recipes';
const listSelect = {
    id: true,
    title: true,
    slug: true,
    servings: true,
    cookMinutes: true,
    difficulty: true,
    image: true,
    dish: { select: { id: true, name: true, slug: true } },
};
const detailSelect = {
    ...listSelect,
    stepsJson: true,
    ingredients: { orderBy: { id: 'asc' }, select: { id: true, name: true, quantity: true, unit: true } },
};
const summary = {
    id: 3,
    title: 'Phở bò tái',
    slug: 'pho-bo-tai',
    servings: 4,
    cookMinutes: 180,
    difficulty: 'HARD',
    image: null,
    dish: { id: 1, name: 'Phở bò', slug: 'pho-bo' },
};

function expectNoQuery() {
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.count).not.toHaveBeenCalled();
    expect(db.findUnique).not.toHaveBeenCalled();
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('GET /api/v1/admin/recipes', () => {
    it('lists recipes with default pagination ordered by title then id without caching', async () => {
        db.findMany.mockResolvedValue([summary] as never);
        db.count.mockResolvedValue(1);

        const res = await request(app).get(path).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ items: [summary], total: 1, page: 1, limit: 12 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            where: {},
            select: listSelect,
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
            skip: 0,
            take: 12,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith({ where: {} });
    });

    it('filters by a trimmed title search on the requested page', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(5);

        const res = await request(app).get(path).query({ q: '  phở ', page: 3, limit: 2 }).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 5, page: 3, limit: 2 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            where: { title: { contains: 'phở' } },
            select: listSelect,
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
            skip: 4,
            take: 2,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith({ where: { title: { contains: 'phở' } } });
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

    it('rejects unauthenticated requests before querying recipes', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(lookup).not.toHaveBeenCalled();
        expectNoQuery();
    });

    it('rejects regular users before querying recipes', async () => {
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

describe('GET /api/v1/admin/recipes/:id', () => {
    it('returns a recipe with its ingredients and raw steps without caching', async () => {
        const ingredients = [{ id: 9, name: 'Bánh phở', quantity: '500', unit: 'g' }];
        const steps = ['Ninh xương', { text: 'Dữ liệu cũ' }];
        db.findUnique.mockResolvedValue({ ...summary, stepsJson: steps, ingredients } as never);

        const res = await request(app)
            .get(path + '/3')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ recipe: { ...summary, ingredients, steps } });
        expect(res.body.recipe).not.toHaveProperty('stepsJson');
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 3 }, select: detailSelect });
    });

    it('returns 404 when the recipe does not exist', async () => {
        db.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get(path + '/2147483647')
            .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy công thức' });
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

    it('rejects unauthenticated requests before querying the recipe', async () => {
        const res = await request(app).get(path + '/3');

        expect(res.status).toBe(401);
        expectNoQuery();
    });

    it('rejects regular users before querying the recipe', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app)
            .get(path + '/3')
            .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expectNoQuery();
    });

    it('returns a generic server error when the lookup fails', async () => {
        db.findUnique.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app)
            .get(path + '/3')
            .set('Cookie', cookie);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
