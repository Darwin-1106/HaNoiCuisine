// Verify admin access through the real authentication and authorization middleware
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({ prisma: { district: { findMany: vi.fn() } } }));
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
