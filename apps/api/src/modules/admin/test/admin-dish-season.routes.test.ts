// Verify admin dish season links through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        dishSeason: { upsert: vi.fn(), deleteMany: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.dishSeason);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const headers = { Cookie: cookie, Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/dishes';
const seasonPath = path + '/5/seasons/2';
const key = { dishId: 5, seasonId: 2 };
const select = { dishId: true, seasonId: true, bestMonths: true };

function expectNoWrite() {
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
}

function knownError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Database constraint failed', { code, clientVersion: 'test' });
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('PUT /api/v1/admin/dishes/:id/seasons/:seasonId', () => {
    it('saves the trimmed best months without caching', async () => {
        const dishSeason = { ...key, bestMonths: '10-12' };
        db.upsert.mockResolvedValue(dishSeason as never);

        const res = await request(app).put(seasonPath).set(headers).send({ bestMonths: '  10-12 ' });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ dishSeason });
        expect(db.upsert).toHaveBeenCalledExactlyOnceWith({
            where: { dishId_seasonId: key },
            create: dishSeason,
            update: { bestMonths: '10-12' },
            select,
        });
    });

    it('accepts null best months', async () => {
        const dishSeason = { ...key, bestMonths: null };
        db.upsert.mockResolvedValue(dishSeason as never);

        const res = await request(app).put(seasonPath).set(headers).send({ bestMonths: null });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ dishSeason });
        expect(db.upsert).toHaveBeenCalledExactlyOnceWith({
            where: { dishId_seasonId: key },
            create: dishSeason,
            update: { bestMonths: null },
            select,
        });
    });

    it('retries the same upsert once after a duplicate key error', async () => {
        const dishSeason = { ...key, bestMonths: '1-3' };
        db.upsert.mockRejectedValueOnce(knownError('P2002')).mockResolvedValueOnce(dishSeason as never);

        const res = await request(app).put(seasonPath).set(headers).send({ bestMonths: '1-3' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ dishSeason });
        expect(db.upsert).toHaveBeenCalledTimes(2);
        expect(db.upsert.mock.calls[1]).toEqual(db.upsert.mock.calls[0]);
    });

    it('returns 404 without retrying when the dish or season is missing', async () => {
        db.upsert.mockRejectedValue(knownError('P2003'));

        const res = await request(app).put(seasonPath).set(headers).send({ bestMonths: '1-3' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy món ăn hoặc mùa' });
        expect(db.upsert).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['/0/seasons/2', 'id'],
        ['/01/seasons/2', 'id'],
        ['/abc/seasons/2', 'id'],
        ['/5/seasons/-1', 'seasonId'],
        ['/5/seasons/1.5', 'seasonId'],
        ['/5/seasons/2147483648', 'seasonId'],
    ])('rejects invalid URL parameters %s before writing', async (suffix, field) => {
        const res = await request(app)
            .put(path + suffix)
            .set(headers)
            .send({ bestMonths: '1-3' });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            error: 'Tham số không hợp lệ',
            details: { fieldErrors: { [field]: [expect.any(String)] } },
        });
        expectNoWrite();
    });

    it.each([
        {},
        { bestMonths: '' },
        { bestMonths: '   ' },
        { bestMonths: 'a'.repeat(51) },
        { bestMonths: 12 },
        { bestMonths: '1-3', seasonId: 9 },
    ])('rejects invalid body %o before writing', async (input) => {
        const res = await request(app).put(seasonPath).set(headers).send(input);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dữ liệu không hợp lệ');
        expectNoWrite();
    });
});

describe('DELETE /api/v1/admin/dishes/:id/seasons/:seasonId', () => {
    it('returns an empty 204 on removal and when the same request is repeated', async () => {
        db.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

        const first = await request(app).delete(seasonPath).set(headers);
        const repeated = await request(app).delete(seasonPath).set(headers);

        expect(first.status).toBe(204);
        expect(first.text).toBe('');
        expect(first.headers['cache-control']).toBe('no-store');
        expect(repeated.status).toBe(204);
        expect(repeated.text).toBe('');
        expect(db.deleteMany.mock.calls).toEqual([[{ where: key }], [{ where: key }]]);
    });

    it.each([
        ['/0/seasons/2', 'id'],
        ['/5/seasons/2147483648', 'seasonId'],
    ])('rejects invalid URL parameters %s before deleting', async (suffix, field) => {
        const res = await request(app)
            .delete(path + suffix)
            .set(headers);

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            error: 'Tham số không hợp lệ',
            details: { fieldErrors: { [field]: [expect.any(String)] } },
        });
        expectNoWrite();
    });
});

describe.each([
    ['put', { bestMonths: '1-3' }],
    ['delete', undefined],
] as const)('%s dish season protection', (method, body) => {
    it('requires a session before writing', async () => {
        const res = await request(app)
            [method](seasonPath)
            .set({ Origin: headers.Origin, 'X-CSRF-Protection': '1' })
            .send(body);

        expect(res.status).toBe(401);
        expect(lookup).not.toHaveBeenCalled();
        expectNoWrite();
    });

    it('rejects regular users before writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app)[method](seasonPath).set(headers).send(body);

        expect(res.status).toBe(403);
        expectNoWrite();
    });

    it('requires CSRF headers before looking up the session or writing', async () => {
        const res = await request(app)[method](seasonPath).set('Cookie', cookie).send(body);

        expect(res.status).toBe(403);
        expect(lookup).not.toHaveBeenCalled();
        expectNoWrite();
    });

    it('returns a generic server error for an unexpected database error', async () => {
        db.upsert.mockRejectedValue(new Error('Private database error'));
        db.deleteMany.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app)[method](seasonPath).set(headers).send(body);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
