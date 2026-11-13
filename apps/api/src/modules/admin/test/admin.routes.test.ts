// Verify admin access through the real authentication and authorization middleware
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        district: { findMany: vi.fn() },
        article: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const lookupSession = vi.mocked(getUserBySessionToken);
const app = createApp();
const path = '/api/v1/admin/status';
const user = { id: 7, email: 'an@example.com', name: 'An' };

describe('Admin authorization', () => {
    it('rejects a request without a session cookie', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(lookupSession).not.toHaveBeenCalled();
    });

    it('rejects an expired or revoked session', async () => {
        lookupSession.mockResolvedValue(null);

        const res = await request(app).get(path).set('Cookie', 'token=revoked-token');

        expect(res.status).toBe(401);
        expect(lookupSession).toHaveBeenCalledExactlyOnceWith('revoked-token');
    });

    it('rejects a regular user even when the client claims the admin role', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'USER' });

        const res = await request(app).get(path).set('Cookie', 'token=session-token; role=ADMIN');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Bạn không có quyền truy cập' });
        expect(lookupSession).toHaveBeenCalledExactlyOnceWith('session-token');
    });

    it('allows a session whose current user has the admin role', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'ADMIN' });

        const res = await request(app).get(path).set('Cookie', 'token=session-token');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        expect(lookupSession).toHaveBeenCalledExactlyOnceWith('session-token');
    });
});

describe('GET /api/v1/admin/districts', () => {
    const districtPath = '/api/v1/admin/districts';
    const cookie = 'token=session-token';
    const findDistricts = vi.mocked(prisma.district.findMany);

    it('returns the sorted district choices to an admin without caching', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'ADMIN' });
        const items = [
            { id: 2, name: 'Ba Đình', slug: 'ba-dinh' },
            { id: 1, name: 'Hoàn Kiếm', slug: 'hoan-kiem' },
        ];
        findDistricts.mockResolvedValue(items);

        const res = await request(app).get(districtPath).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ items });
        expect(findDistricts).toHaveBeenCalledExactlyOnceWith({
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });
    });

    it('rejects unauthenticated requests before querying districts', async () => {
        const res = await request(app).get(districtPath);

        expect(res.status).toBe(401);
        expect(findDistricts).not.toHaveBeenCalled();
    });

    it('rejects regular users before querying districts', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'USER' });

        const res = await request(app).get(districtPath).set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(findDistricts).not.toHaveBeenCalled();
    });

    it('returns a generic server error when the query fails', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'ADMIN' });
        findDistricts.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app).get(districtPath).set('Cookie', cookie);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('GET /api/v1/admin/articles', () => {
    const articlesPath = '/api/v1/admin/articles';
    const cookie = 'token=session-token';
    const articles = vi.mocked(prisma.article);
    const admin = { ...user, role: 'ADMIN' as const };

    it('returns draft and published articles on the requested page without caching', async () => {
        lookupSession.mockResolvedValue(admin);
        const createdAt = new Date('2026-11-10T00:00:00.000Z');
        const items = [
            { id: 4, title: 'Bài nháp', slug: 'bai-nhap', publishedAt: null, createdAt },
            { id: 3, title: 'Bài đã đăng', slug: 'bai-da-dang', publishedAt: createdAt, createdAt },
        ];
        articles.findMany.mockResolvedValue(items as never);
        articles.count.mockResolvedValue(5);

        const res = await request(app).get(articlesPath).query({ page: 2, limit: 2 }).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({
            items: [
                { ...items[0], createdAt: createdAt.toISOString() },
                { ...items[1], createdAt: createdAt.toISOString(), publishedAt: createdAt.toISOString() },
            ],
            total: 5,
            page: 2,
            limit: 2,
        });
        expect(articles.findMany).toHaveBeenCalledExactlyOnceWith({
            select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: 2,
            take: 2,
        });
        expect(articles.count).toHaveBeenCalledExactlyOnceWith();
    });

    it('uses default pagination for an empty list', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.findMany.mockResolvedValue([]);
        articles.count.mockResolvedValue(0);

        const res = await request(app).get(articlesPath).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(articles.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ skip: 0, take: 12 }));
    });

    it.each([
        ['page', '0'],
        ['page', '10001'],
        ['limit', '51'],
    ])('rejects invalid %s=%s before querying articles', async (field, value) => {
        lookupSession.mockResolvedValue(admin);

        const res = await request(app)
            .get(articlesPath)
            .query({ [field]: value })
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            error: 'Tham số không hợp lệ',
            details: { fieldErrors: { [field]: [expect.any(String)] } },
        });
        expect(articles.findMany).not.toHaveBeenCalled();
        expect(articles.count).not.toHaveBeenCalled();
    });

    it.each([401, 403])('returns %i before querying articles for a caller without admin access', async (status) => {
        const req = request(app).get(articlesPath);
        if (status === 403) {
            lookupSession.mockResolvedValue({ ...user, role: 'USER' });
            req.set('Cookie', cookie);
        }

        const res = await req;

        expect(res.status).toBe(status);
        expect(articles.findMany).not.toHaveBeenCalled();
        expect(articles.count).not.toHaveBeenCalled();
    });

    it('returns a generic server error when the article query fails', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.findMany.mockRejectedValue(new Error('Private database error'));
        articles.count.mockResolvedValue(0);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app).get(articlesPath).set('Cookie', cookie);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('Admin article editing', () => {
    const path = '/api/v1/admin/articles';
    const admin = { ...user, role: 'ADMIN' as const };
    const headers = { Cookie: 'token=session-token', Origin: 'test-origin', 'X-CSRF-Protection': '1' };
    const articles = vi.mocked(prisma.article);
    const body = { title: 'Bài cẩm nang', slug: 'bai-cam-nang', contentMd: '# Nội dung' };
    const draft = {
        ...body,
        id: 12,
        summary: null,
        coverImage: null,
        authorId: admin.id,
        publishedAt: null,
        createdAt: new Date('2026-11-13T00:00:00Z'),
    };

    it('returns the full draft to an admin without caching', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.findUnique.mockResolvedValue(draft);

        const res = await request(app)
            .get(path + '/12')
            .set('Cookie', headers.Cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.article).toMatchObject({ ...body, id: 12, publishedAt: null });
        expect(articles.findUnique).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ where: { id: 12 } }));
    });

    it('returns 404 when an article does not exist', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get(path + '/12')
            .set('Cookie', headers.Cookie);

        expect(res.status).toBe(404);
    });

    it('rejects an invalid ID before reading', async () => {
        lookupSession.mockResolvedValue(admin);

        const res = await request(app)
            .get(path + '/2147483648')
            .set('Cookie', headers.Cookie);

        expect(res.status).toBe(400);
        expect(articles.findUnique).not.toHaveBeenCalled();
    });

    it('creates a draft attributed to the current admin', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.create.mockResolvedValue(draft);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, title: '  Bài cẩm nang  ' });

        expect(res.status).toBe(201);
        expect(res.body.article).toMatchObject({ ...body, id: 12, publishedAt: null });
        expect(articles.create).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ data: { ...body, authorId: admin.id, publishedAt: null } }),
        );
    });

    it.each([{ publishedAt: null }, { authorId: 2 }, { contentMd: ' ' }, { slug: 'Sai slug' }])(
        'rejects invalid draft input %o',
        async (input) => {
            lookupSession.mockResolvedValue(admin);

            const res = await request(app)
                .post(path)
                .set(headers)
                .send({ ...body, ...input });

            expect(res.status).toBe(400);
            expect(articles.create).not.toHaveBeenCalled();
        },
    );

    it('updates only the provided fields, including clearing a summary', async () => {
        lookupSession.mockResolvedValue(admin);
        articles.update.mockResolvedValue(draft);

        const res = await request(app)
            .patch(path + '/12')
            .set(headers)
            .send({ summary: null });

        expect(res.status).toBe(200);
        expect(articles.update).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ where: { id: 12 }, data: { summary: null } }),
        );
    });

    it.each([{}, { publishedAt: null }, { authorId: 2 }])('rejects invalid edits %o', async (input) => {
        lookupSession.mockResolvedValue(admin);

        const res = await request(app)
            .patch(path + '/12')
            .set(headers)
            .send(input);

        expect(res.status).toBe(400);
        expect(articles.update).not.toHaveBeenCalled();
    });

    it.each([
        ['post', '', 'create', 'P2002', 409],
        ['patch', '/12', 'update', 'P2002', 409],
        ['patch', '/12', 'update', 'P2025', 404],
    ] as const)('maps %s %s Prisma %s %s to %i', async (method, suffix, operation, code, status) => {
        lookupSession.mockResolvedValue(admin);
        articles[operation].mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Database error', { code, clientVersion: 'test' }),
        );

        const res = await request(app)
            [method](path + suffix)
            .set(headers)
            .send(body);

        expect(res.status).toBe(status);
    });

    it('blocks regular users from reading draft details or writing articles', async () => {
        lookupSession.mockResolvedValue({ ...user, role: 'USER' });

        const detail = await request(app)
            .get(path + '/12')
            .set('Cookie', headers.Cookie);
        const create = await request(app).post(path).set(headers).send(body);
        const update = await request(app)
            .patch(path + '/12')
            .set(headers)
            .send(body);

        expect([detail.status, create.status, update.status]).toEqual([403, 403, 403]);
        expect(articles.findUnique).not.toHaveBeenCalled();
        expect(articles.create).not.toHaveBeenCalled();
        expect(articles.update).not.toHaveBeenCalled();
    });

    it('blocks writes without CSRF headers', async () => {
        const create = await request(app).post(path).set('Cookie', headers.Cookie).send(body);
        const update = await request(app)
            .patch(path + '/12')
            .set('Cookie', headers.Cookie)
            .send(body);

        expect([create.status, update.status]).toEqual([403, 403]);
        expect(lookupSession).not.toHaveBeenCalled();
        expect(articles.create).not.toHaveBeenCalled();
        expect(articles.update).not.toHaveBeenCalled();
    });
});
