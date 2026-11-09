// Verify admin restaurant requests through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: { restaurant: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.restaurant);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const headers = { Cookie: cookie, Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/restaurants';

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('Admin restaurants', () => {
    it('lists both visibility states in a stable page without caching', async () => {
        const hidden = {
            id: 3,
            slug: 'pho-thin',
            name: 'Phở Thìn',
            address: 'Hà Nội',
            districtId: 1,
            published: false,
        };
        const visible = { ...hidden, id: 4, slug: 'bun-cha', name: 'Bún chả', published: true };
        db.findMany.mockResolvedValue([hidden, visible] as never);
        db.count.mockResolvedValue(4);

        const res = await request(app)
            .get(path + '?page=2&limit=2')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ items: [hidden, visible], total: 4, page: 2, limit: 2 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            select: { id: true, name: true, slug: true, address: true, districtId: true, published: true },
            orderBy: { id: 'asc' },
            skip: 2,
            take: 2,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith();
    });

    it.each(['page=0', 'page=10001', 'limit=51'])('rejects invalid pagination %s', async (query) => {
        const res = await request(app)
            .get(path + '?' + query)
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(db.findMany).not.toHaveBeenCalled();
        expect(db.count).not.toHaveBeenCalled();
    });

    it.each([false, true])('sets only published to %s', async (published) => {
        db.update.mockResolvedValue({ id: 3, published } as never);

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant: { id: 3, published } });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { published },
            select: { id: true, published: true },
        });
    });

    it.each(['0', '1e2', '2147483648'])('rejects invalid IDs %s', async (id) => {
        const res = await request(app)
            .patch(path + '/' + id + '/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it.each([{}, { published: 'false' }, { published: false, name: 'Changed' }])(
        'rejects invalid visibility bodies %o',
        async (body) => {
            const res = await request(app)
                .patch(path + '/3/visibility')
                .set(headers)
                .send(body);

            expect(res.status).toBe(400);
            expect(db.update).not.toHaveBeenCalled();
        },
    );

    it('returns 404 when the restaurant does not exist', async () => {
        db.update.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Missing restaurant', { code: 'P2025', clientVersion: 'test' }),
        );

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy quán' });
    });

    it('returns 500 for an unexpected database error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        db.update.mockRejectedValue(new Error('Private database error'));

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });

    it('rejects a list without a session', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(db.findMany).not.toHaveBeenCalled();
    });

    it('rejects regular users before reading or writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const list = await request(app).get(path).set('Cookie', cookie);
        const update = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(list.status).toBe(403);
        expect(update.status).toBe(403);
        expect(db.findMany).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });

    it('rejects writes without CSRF headers before looking up the session', async () => {
        const res = await request(app)
            .patch(path + '/3/visibility')
            .set('Cookie', cookie)
            .send({ published: false });

        expect(res.status).toBe(403);
        expect(lookup).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });
});
