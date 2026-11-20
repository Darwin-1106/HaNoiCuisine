// Verify admin dish creation and updates through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        dish: { create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.dish);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const headers = { Cookie: cookie, Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/dishes';
const editPath = path + '/5';
const writeSelect = { id: true, name: true, slug: true, description: true, originStory: true, image: true };
const body = { name: 'Phở bò', slug: 'pho-bo', description: 'Món nước', originStory: 'Từ Nam Định' };

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

describe('POST /api/v1/admin/dishes', () => {
    it('creates a dish with trimmed fields without caching', async () => {
        const dish = { id: 5, ...body, image: null };
        db.create.mockResolvedValue(dish as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, name: '  Phở bò  ', slug: ' pho-bo ' });

        expect(res.status).toBe(201);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ dish });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({ data: body, select: writeSelect });
    });

    it('creates a dish with only the required fields and accepts null texts', async () => {
        const dish = { id: 6, name: 'Bún chả', slug: 'bun-cha', description: null, originStory: null, image: null };
        db.create.mockResolvedValue(dish as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ name: 'Bún chả', slug: 'bun-cha', description: null });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ dish });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: { name: 'Bún chả', slug: 'bun-cha', description: null },
            select: writeSelect,
        });
    });

    it.each([
        {},
        { slug: body.slug },
        { name: body.name },
        { ...body, name: '   ' },
        { ...body, name: 'a'.repeat(201) },
        { ...body, slug: 'Phở Bò' },
        { ...body, slug: 'pho--bo' },
        { ...body, slug: 'a'.repeat(221) },
        { ...body, description: '' },
        { ...body, description: 'a'.repeat(5_001) },
        { ...body, originStory: 'a'.repeat(10_001) },
        { ...body, originStory: 42 },
        { ...body, image: 'https://example.com/pho.jpg' },
        { ...body, id: 9 },
    ])('rejects invalid body %o before writing', async (input) => {
        const res = await request(app).post(path).set(headers).send(input);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dữ liệu không hợp lệ');
        expectNoWrite();
    });

    it('returns 409 when the slug is already used', async () => {
        db.create.mockRejectedValue(knownError('P2002'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
        expect(db.create).toHaveBeenCalledTimes(1);
    });
});

describe('PATCH /api/v1/admin/dishes/:id', () => {
    it('updates only the provided fields without caching', async () => {
        const dish = { id: 5, ...body, description: 'Mô tả mới', image: null };
        db.update.mockResolvedValue(dish as never);

        const res = await request(app).patch(editPath).set(headers).send({ description: '  Mô tả mới  ' });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ dish });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 5 },
            data: { description: 'Mô tả mới' },
            select: writeSelect,
        });
    });

    it('clears an optional text with null', async () => {
        const dish = { id: 5, ...body, originStory: null, image: null };
        db.update.mockResolvedValue(dish as never);

        const res = await request(app).patch(editPath).set(headers).send({ originStory: null });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ dish });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 5 },
            data: { originStory: null },
            select: writeSelect,
        });
    });

    it('returns 404 when the dish does not exist', async () => {
        db.update.mockRejectedValue(knownError('P2025'));

        const res = await request(app)
            .patch(path + '/2147483647')
            .set(headers)
            .send({ name: 'Phở gà' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy món ăn' });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 2_147_483_647 },
            data: { name: 'Phở gà' },
            select: writeSelect,
        });
    });

    it('returns 409 when the new slug is already used', async () => {
        db.update.mockRejectedValue(knownError('P2002'));

        const res = await request(app).patch(editPath).set(headers).send({ slug: 'bun-cha' });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it.each(['0', '-1', '01', '1.5', 'abc', '2147483648'])('rejects invalid id %s before writing', async (id) => {
        const res = await request(app)
            .patch(path + '/' + id)
            .set(headers)
            .send({ name: 'Phở gà' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expectNoWrite();
    });

    it.each([{}, { name: ' ' }, { slug: 'Bún Chả' }, { image: null }, { restaurantCount: 1 }])(
        'rejects invalid body %o before writing',
        async (input) => {
            const res = await request(app).patch(editPath).set(headers).send(input);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expectNoWrite();
        },
    );
});

describe.each([
    ['post', path],
    ['patch', editPath],
] as const)('%s %s protection', (method, url) => {
    it('requires a session before writing', async () => {
        const res = await request(app)
            [method](url)
            .set({ Origin: headers.Origin, 'X-CSRF-Protection': '1' })
            .send(body);

        expect(res.status).toBe(401);
        expect(lookup).not.toHaveBeenCalled();
        expectNoWrite();
    });

    it('rejects regular users before writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app)[method](url).set(headers).send(body);

        expect(res.status).toBe(403);
        expectNoWrite();
    });

    it('requires CSRF headers before looking up the session or writing', async () => {
        const res = await request(app)[method](url).set('Cookie', cookie).send(body);

        expect(res.status).toBe(403);
        expect(lookup).not.toHaveBeenCalled();
        expectNoWrite();
    });

    it('returns a generic server error for an unexpected database error', async () => {
        db.create.mockRejectedValue(new Error('Private database error'));
        db.update.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app)[method](url).set(headers).send(body);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
