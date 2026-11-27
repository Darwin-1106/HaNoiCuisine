// Verify admin tag list, creation, and updates through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        tag: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.tag);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const headers = { Cookie: cookie, Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/tags';
const editPath = path + '/5';
const listSelect = { id: true, name: true, slug: true, _count: { select: { dishes: true, restaurants: true } } };
const writeSelect = { id: true, name: true, slug: true };
const body = { name: 'Ăn sáng', slug: 'an-sang' };

function expectNoQuery() {
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.count).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
}

function knownError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Database constraint failed', { code, clientVersion: 'test' });
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('GET /api/v1/admin/tags', () => {
    it('lists tags with counts ordered by name then id without caching', async () => {
        db.findMany.mockResolvedValue([
            { id: 2, name: 'Ăn sáng', slug: 'an-sang', _count: { dishes: 3, restaurants: 1 } },
            { id: 1, name: 'Vỉa hè', slug: 'via-he', _count: { dishes: 0, restaurants: 4 } },
        ] as never);
        db.count.mockResolvedValue(2);

        const res = await request(app).get(path).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({
            items: [
                { id: 2, name: 'Ăn sáng', slug: 'an-sang', dishCount: 3, restaurantCount: 1 },
                { id: 1, name: 'Vỉa hè', slug: 'via-he', dishCount: 0, restaurantCount: 4 },
            ],
            total: 2,
            page: 1,
            limit: 12,
        });
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

        const res = await request(app).get(path).query({ q: '  sáng ', page: 3, limit: 2 }).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 5, page: 3, limit: 2 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            where: { name: { contains: 'sáng' } },
            select: listSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: 4,
            take: 2,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith({ where: { name: { contains: 'sáng' } } });
    });

    it.each([
        { page: 0 },
        { page: 10_001 },
        { limit: 0 },
        { limit: 51 },
        { page: 'abc' },
        { q: '  ' },
        { q: 'a'.repeat(101) },
    ])('rejects invalid query %o before querying', async (query) => {
        const res = await request(app).get(path).query(query).set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expectNoQuery();
    });

    it('rejects unauthenticated requests before querying tags', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(lookup).not.toHaveBeenCalled();
        expectNoQuery();
    });

    it('rejects regular users before querying tags', async () => {
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

describe('POST /api/v1/admin/tags', () => {
    it('creates a tag with trimmed fields without caching', async () => {
        const tag = { id: 5, ...body };
        db.create.mockResolvedValue(tag as never);

        const res = await request(app).post(path).set(headers).send({ name: '  Ăn sáng ', slug: ' an-sang ' });

        expect(res.status).toBe(201);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ tag });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({ data: body, select: writeSelect });
    });

    it.each([
        {},
        { name: body.name },
        { slug: body.slug },
        { ...body, name: '   ' },
        { ...body, name: 'a'.repeat(101) },
        { ...body, slug: 'Ăn Sáng' },
        { ...body, slug: 'an--sang' },
        { ...body, slug: 'a'.repeat(121) },
        { ...body, name: 42 },
        { ...body, id: 9 },
        { ...body, dishCount: 1 },
    ])('rejects invalid body %o before writing', async (input) => {
        const res = await request(app).post(path).set(headers).send(input);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dữ liệu không hợp lệ');
        expectNoQuery();
    });

    it('returns 409 when the slug is already used', async () => {
        db.create.mockRejectedValue(knownError('P2002'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
        expect(db.create).toHaveBeenCalledTimes(1);
    });
});

describe('PATCH /api/v1/admin/tags/:id', () => {
    it('updates only the provided fields without caching', async () => {
        const tag = { id: 5, name: 'Bữa sáng', slug: 'an-sang' };
        db.update.mockResolvedValue(tag as never);

        const res = await request(app).patch(editPath).set(headers).send({ name: '  Bữa sáng  ' });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ tag });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 5 },
            data: { name: 'Bữa sáng' },
            select: writeSelect,
        });
    });

    it('returns 404 when the tag does not exist', async () => {
        db.update.mockRejectedValue(knownError('P2025'));

        const res = await request(app)
            .patch(path + '/2147483647')
            .set(headers)
            .send({ slug: 'bua-sang' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy thẻ' });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 2_147_483_647 },
            data: { slug: 'bua-sang' },
            select: writeSelect,
        });
    });

    it('returns 409 when the new slug is already used', async () => {
        db.update.mockRejectedValue(knownError('P2002'));

        const res = await request(app).patch(editPath).set(headers).send({ slug: 'via-he' });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it.each(['0', '-1', '01', '1.5', 'abc', '2147483648'])('rejects invalid id %s before writing', async (id) => {
        const res = await request(app)
            .patch(path + '/' + id)
            .set(headers)
            .send({ name: 'Bữa sáng' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expectNoQuery();
    });

    it.each([{}, { name: ' ' }, { slug: 'Bữa Sáng' }, { name: null }, { restaurantCount: 1 }])(
        'rejects invalid body %o before writing',
        async (input) => {
            const res = await request(app).patch(editPath).set(headers).send(input);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expectNoQuery();
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
        expectNoQuery();
    });

    it('rejects regular users before writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app)[method](url).set(headers).send(body);

        expect(res.status).toBe(403);
        expectNoQuery();
    });

    it('requires CSRF headers before looking up the session or writing', async () => {
        const res = await request(app)[method](url).set('Cookie', cookie).send(body);

        expect(res.status).toBe(403);
        expect(lookup).not.toHaveBeenCalled();
        expectNoQuery();
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
