// Favorite route tests: session identity, CSRF, validation and responses
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';
import * as favorites from '../services/favorite.service.js';

vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));
vi.mock('../services/favorite.service.js', () => ({
    listFavorites: vi.fn(),
    saveFavorite: vi.fn(),
    removeFavorite: vi.fn(),
}));

const auth = vi.mocked(getUserBySessionToken);
const service = vi.mocked(favorites);
const app = createApp();
const listPath = '/api/v1/favorites';
const writePath = '/api/v1/restaurants/pho-thin/favorite';
const csrf = { Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const session = { ...csrf, Cookie: 'token=session-token' };

beforeEach(() => {
    auth.mockResolvedValue({ id: 7, email: 'an@example.com', name: 'An', role: 'USER' });
});

describe('Favorites routes', () => {
    it.each([
        ['get', listPath],
        ['put', writePath],
        ['delete', writePath],
    ] as const)('requires a session for %s %s', async (method, path) => {
        const res = await request(app)[method](path).set(csrf);
        expect(res.status).toBe(401);
        expect(service.listFavorites).not.toHaveBeenCalled();
        expect(service.saveFavorite).not.toHaveBeenCalled();
        expect(service.removeFavorite).not.toHaveBeenCalled();
    });

    it.each(['put', 'delete'] as const)('requires CSRF headers for %s', async (method) => {
        const res = await request(app)[method](writePath).set('Cookie', session.Cookie);
        expect(res.status).toBe(403);
        expect(auth).not.toHaveBeenCalled();
        expect(service.saveFavorite).not.toHaveBeenCalled();
        expect(service.removeFavorite).not.toHaveBeenCalled();
    });

    it.each([
        ['', 1, 12],
        ['?page=2&limit=5&userId=99', 2, 5],
    ] as const)('lists only the session user data with pagination %s', async (query, page, limit) => {
        const result = { items: [], total: 0, page, limit };
        service.listFavorites.mockResolvedValue(result);

        const res = await request(app)
            .get(listPath + query)
            .set('Cookie', session.Cookie);
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual(result);
        expect(service.listFavorites).toHaveBeenCalledExactlyOnceWith(7, { page, limit });
    });

    it.each(['page=0', 'page=10001', 'limit=51', 'limit=abc'])('rejects invalid pagination %s', async (query) => {
        const res = await request(app).get(`${listPath}?${query}`).set('Cookie', session.Cookie);
        expect(res.status).toBe(400);
        expect(service.listFavorites).not.toHaveBeenCalled();
    });

    it.each(['put', 'delete'] as const)('rejects invalid slugs on %s', async (method) => {
        const res = await request(app)[method]('/api/v1/restaurants/Pho-Thin/favorite').set(session);
        expect(res.status).toBe(400);
        expect(service.saveFavorite).not.toHaveBeenCalled();
        expect(service.removeFavorite).not.toHaveBeenCalled();
    });

    it('saves for the session user even when the body contains another user ID', async () => {
        service.saveFavorite.mockResolvedValue(true);

        const res = await request(app).put(writePath).set(session).send({ userId: 99 });
        expect(res.status).toBe(204);
        expect(res.text).toBe('');
        expect(service.saveFavorite).toHaveBeenCalledExactlyOnceWith('pho-thin', 7);
    });

    it('returns 404 for a missing or hidden restaurant', async () => {
        service.saveFavorite.mockResolvedValue(false);

        const res = await request(app).put(writePath).set(session);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy quán' });
    });

    it('returns an empty 204 for each repeated removal by the same user', async () => {
        service.removeFavorite.mockResolvedValue(undefined);

        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await request(app).delete(writePath).set(session);
            expect(res.status).toBe(204);
            expect(res.text).toBe('');
        }
        expect(service.removeFavorite.mock.calls).toEqual([
            ['pho-thin', 7],
            ['pho-thin', 7],
        ]);
    });
});
