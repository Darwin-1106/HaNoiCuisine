// Verify admin recipe creation and updates through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        recipe: { create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.recipe);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const headers = { Cookie: 'token=admin-session', Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/recipes';
const editPath = path + '/3';
const detailSelect = {
    id: true,
    title: true,
    slug: true,
    servings: true,
    cookMinutes: true,
    difficulty: true,
    image: true,
    dish: { select: { id: true, name: true, slug: true } },
    stepsJson: true,
    ingredients: { orderBy: { id: 'asc' }, select: { id: true, name: true, quantity: true, unit: true } },
};
const ingredients = [{ name: 'Xương bò', quantity: '1', unit: 'kg' }, { name: 'Hành' }];
const body = {
    dishId: 1,
    title: 'Phở bò tái',
    slug: 'pho-bo-tai',
    servings: 4,
    cookMinutes: 240,
    difficulty: 'HARD',
    steps: ['Ninh xương', 'Chần bánh phở'],
    ingredients,
};
const stored = {
    id: 3,
    title: 'Phở bò tái',
    slug: 'pho-bo-tai',
    servings: 4,
    cookMinutes: 240,
    difficulty: 'HARD',
    image: null,
    dish: { id: 1, name: 'Phở bò', slug: 'pho-bo' },
    stepsJson: ['Ninh xương', 'Chần bánh phở'],
    ingredients: [
        { id: 10, name: 'Xương bò', quantity: '1', unit: 'kg' },
        { id: 11, name: 'Hành', quantity: null, unit: null },
    ],
};
const { stepsJson, ...storedRest } = stored;
const returned = { ...storedRest, steps: stepsJson };

function expectNoWrite() {
    expect(db.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
}

function knownError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Database constraint failed', { code, clientVersion: 'test' });
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('POST /api/v1/admin/recipes', () => {
    it('creates a recipe with its ingredients and steps without caching', async () => {
        db.create.mockResolvedValue(stored as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, title: '  Phở bò tái  ', steps: [' Ninh xương ', 'Chần bánh phở'] });

        expect(res.status).toBe(201);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ recipe: returned });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: {
                dishId: 1,
                title: 'Phở bò tái',
                slug: 'pho-bo-tai',
                servings: 4,
                cookMinutes: 240,
                difficulty: 'HARD',
                stepsJson: ['Ninh xương', 'Chần bánh phở'],
                ingredients: { create: ingredients },
            },
            select: detailSelect,
        });
    });

    it('creates a recipe with only the required fields and no ingredients', async () => {
        db.create.mockResolvedValue({ ...stored, ingredients: [] } as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ dishId: 1, title: 'Phở', slug: 'pho', steps: ['Nấu'] });

        expect(res.status).toBe(201);
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: { dishId: 1, title: 'Phở', slug: 'pho', stepsJson: ['Nấu'], ingredients: { create: [] } },
            select: detailSelect,
        });
    });

    it.each([
        ['missing steps', { steps: undefined }],
        ['no steps', { steps: [] }],
        ['a blank step', { steps: ['Nấu', '  '] }],
        ['more than 100 steps', { steps: Array.from({ length: 101 }, () => 'Bước') }],
        ['a blank title', { title: ' ' }],
        ['an invalid slug', { slug: 'Phở Bò' }],
        ['a text dish id', { dishId: '1' }],
        ['zero servings', { servings: 0 }],
        ['an unknown difficulty', { difficulty: 'easy' }],
        ['a fractional cooking time', { cookMinutes: 1.5 }],
        ['an ingredient without a name', { ingredients: [{ quantity: '1' }] }],
        ['an unknown ingredient field', { ingredients: [{ name: 'Muối', price: 1 }] }],
        ['more than 100 ingredients', { ingredients: Array.from({ length: 101 }, () => ({ name: 'Muối' })) }],
        ['an image', { image: 'https://example.com/a.jpg' }],
        ['raw stored steps', { stepsJson: ['Nấu'] }],
    ])('rejects a body with %s before writing', async (_case, override) => {
        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, ...override });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dữ liệu không hợp lệ');
        expectNoWrite();
    });

    it('returns 409 when the slug is already used', async () => {
        db.create.mockRejectedValue(knownError('P2002'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
    });

    it('returns 400 when the dish does not exist', async () => {
        db.create.mockRejectedValue(knownError('P2003'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Món ăn không tồn tại' });
    });
});

describe('PATCH /api/v1/admin/recipes/:id', () => {
    it('updates only the title and keeps the ingredients and steps untouched', async () => {
        db.update.mockResolvedValue(stored as never);

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Phở bò tái' });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ recipe: returned });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { title: 'Phở bò tái' },
            select: detailSelect,
        });
    });

    it('replaces the whole ingredient list in the same update', async () => {
        db.update.mockResolvedValue(stored as never);

        const res = await request(app).patch(editPath).set(headers).send({ ingredients });

        expect(res.status).toBe(200);
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { ingredients: { deleteMany: {}, create: ingredients } },
            select: detailSelect,
        });
    });

    it('removes every ingredient when an empty list is sent', async () => {
        db.update.mockResolvedValue({ ...stored, ingredients: [] } as never);

        await request(app).patch(editPath).set(headers).send({ ingredients: [] });

        expect(db.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { ingredients: { deleteMany: {}, create: [] } } }),
        );
    });

    it('stores new steps and clears the cooking time', async () => {
        db.update.mockResolvedValue(stored as never);

        await request(app)
            .patch(editPath)
            .set(headers)
            .send({ steps: ['Nấu'], cookMinutes: null, difficulty: 'EASY' });

        expect(db.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { stepsJson: ['Nấu'], cookMinutes: null, difficulty: 'EASY' } }),
        );
    });

    it('returns 404 when the recipe does not exist', async () => {
        db.update.mockRejectedValue(knownError('P2025'));

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Phở' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy công thức' });
    });

    it('returns 409 when the new slug is already used', async () => {
        db.update.mockRejectedValue(knownError('P2002'));

        const res = await request(app).patch(editPath).set(headers).send({ slug: 'pho-bo' });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
    });

    it('returns 400 when the new dish does not exist', async () => {
        db.update.mockRejectedValue(knownError('P2003'));

        const res = await request(app).patch(editPath).set(headers).send({ dishId: 999 });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Món ăn không tồn tại' });
    });

    it.each(['0', '-1', '01', '1.5', 'abc', '2147483648'])('rejects invalid id %s before writing', async (id) => {
        const res = await request(app).patch(`${path}/${id}`).set(headers).send({ title: 'Phở' });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            error: 'Tham số không hợp lệ',
            details: { fieldErrors: { id: [expect.any(String)] } },
        });
        expectNoWrite();
    });

    it.each([{}, { title: ' ' }, { steps: [] }, { ingredient: [{ name: 'Muối' }] }, { image: null }])(
        'rejects the update body %o before writing',
        async (update) => {
            const res = await request(app).patch(editPath).set(headers).send(update);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expectNoWrite();
        },
    );
});

describe('Admin recipe write protection', () => {
    it('requires a session before writing', async () => {
        const res = await request(app)
            .post(path)
            .set({ ...headers, Cookie: '' })
            .send(body);

        expect(res.status).toBe(401);
        expectNoWrite();
    });

    it('rejects regular users before writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Phở' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Bạn không có quyền truy cập' });
        expectNoWrite();
    });

    it.each([
        ['without the CSRF header', { Cookie: headers.Cookie, Origin: headers.Origin }],
        ['from another origin', { ...headers, Origin: 'https://evil.example' }],
    ])('rejects a request %s before writing', async (_case, requestHeaders) => {
        const res = await request(app).post(path).set(requestHeaders).send(body);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Yêu cầu không được phép' });
        expectNoWrite();
    });

    it('returns a generic server error for an unexpected database error', async () => {
        db.update.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Phở' });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
