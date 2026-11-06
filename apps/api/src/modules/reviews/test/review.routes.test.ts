// Review route tests: authentication, validation, creation and error responses
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as authService from '../../auth/services/auth.service.js';
import * as reviewService from '../services/review.service.js';

vi.mock('../../auth/services/auth.service.js', () => ({
    getUserBySessionToken: vi.fn(),
}));

vi.mock('../services/review.service.js', () => ({
    createReview: vi.fn(),
    updateOwnReview: vi.fn(),
    deleteOwnReview: vi.fn(),
}));

const auth = vi.mocked(authService);
const service = vi.mocked(reviewService);
const app = createApp();
const user = { id: 7, email: 'an@example.com', name: 'An', role: 'USER' as const };
const review = {
    id: 1,
    rating: 5,
    comment: 'Ngon',
    createdAt: new Date('2026-01-01'),
    user: { name: 'An' },
};

function postReview(slug = 'pho-thin') {
    return request(app)
        .post(`/api/v1/restaurants/${slug}/reviews`)
        .set('Origin', 'test-origin')
        .set('X-CSRF-Protection', '1')
        .set('Cookie', 'token=session-token');
}

beforeEach(() => {
    auth.getUserBySessionToken.mockResolvedValue(user);
});

describe('POST /api/v1/restaurants/:slug/reviews', () => {
    it('creates a review using the authenticated user ID', async () => {
        service.createReview.mockResolvedValue({ status: 'created', review });

        const res = await postReview().send({ rating: 5, comment: '  Ngon  ' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            review: { ...review, createdAt: review.createdAt.toISOString() },
        });
        expect(service.createReview).toHaveBeenCalledExactlyOnceWith('pho-thin', user.id, {
            rating: 5,
            comment: 'Ngon',
        });
    });

    it('rejects requests without a session', async () => {
        const res = await request(app)
            .post('/api/v1/restaurants/pho-thin/reviews')
            .set('Origin', 'test-origin')
            .set('X-CSRF-Protection', '1')
            .send({ rating: 5 });

        expect(res.status).toBe(401);
        expect(service.createReview).not.toHaveBeenCalled();
    });

    it('rejects an expired or unknown session', async () => {
        auth.getUserBySessionToken.mockResolvedValue(null);

        const res = await postReview().send({ rating: 5 });

        expect(res.status).toBe(401);
        expect(service.createReview).not.toHaveBeenCalled();
    });

    it('rejects requests without CSRF headers', async () => {
        const res = await request(app)
            .post('/api/v1/restaurants/pho-thin/reviews')
            .set('Cookie', 'token=session-token')
            .send({ rating: 5 });

        expect(res.status).toBe(403);
        expect(auth.getUserBySessionToken).not.toHaveBeenCalled();
        expect(service.createReview).not.toHaveBeenCalled();
    });

    it.each([
        {},
        { rating: 0 },
        { rating: 6 },
        { rating: 2.5 },
        { rating: '5' },
        { rating: 5, comment: '   ' },
        { rating: 5, comment: 'a'.repeat(2001) },
        { rating: 5, userId: 99 },
    ])('rejects invalid body %o', async (body) => {
        const res = await postReview().send(body);

        expect(res.status).toBe(400);
        expect(service.createReview).not.toHaveBeenCalled();
    });

    it('rejects an invalid restaurant slug', async () => {
        const res = await postReview('Pho-Thin').send({ rating: 5 });

        expect(res.status).toBe(400);
        expect(service.createReview).not.toHaveBeenCalled();
    });

    it.each([
        ['not_found', 404, 'Không tìm thấy quán'],
        ['duplicate', 409, 'Bạn đã đánh giá quán này'],
    ] as const)('handles %s', async (status, code, error) => {
        service.createReview.mockResolvedValue({ status });

        const res = await postReview().send({ rating: 5 });

        expect(res.status).toBe(code);
        expect(res.body).toEqual({ error });
    });

    it('returns 500 without exposing internal errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        service.createReview.mockRejectedValue(new Error('private database error'));

        const res = await postReview().send({ rating: 5 });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('Manage own review', () => {
    const path = '/api/v1/restaurants/pho-thin/reviews/me';
    const csrfHeaders = { Origin: 'test-origin', 'X-CSRF-Protection': '1' };
    const sessionHeaders = { ...csrfHeaders, Cookie: 'token=session-token' };

    it.each([
        [{ rating: 4 }, { rating: 4 }],
        [{ comment: '  Nước dùng ngon  ' }, { comment: 'Nước dùng ngon' }],
        [{ comment: null }, { comment: null }],
    ])('updates only the submitted fields for the authenticated user: %o', async (body, parsedBody) => {
        service.updateOwnReview.mockResolvedValue(true);

        const res = await request(app).patch(path).set(sessionHeaders).send(body);

        expect(res.status).toBe(204);
        expect(res.text).toBe('');
        expect(service.updateOwnReview).toHaveBeenCalledExactlyOnceWith('pho-thin', user.id, parsedBody);
    });

    it('deletes the authenticated user review without a request body', async () => {
        service.deleteOwnReview.mockResolvedValue(true);

        const res = await request(app).delete(path).set(sessionHeaders);

        expect(res.status).toBe(204);
        expect(res.text).toBe('');
        expect(service.deleteOwnReview).toHaveBeenCalledExactlyOnceWith('pho-thin', user.id);
    });

    it.each([{}, { rating: '4' }, { rating: 6 }, { comment: '   ' }, { rating: 4, userId: 99 }])(
        'rejects an invalid patch body: %o',
        async (body) => {
            const res = await request(app).patch(path).set(sessionHeaders).send(body);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expect(service.updateOwnReview).not.toHaveBeenCalled();
        },
    );

    describe.each(['patch', 'delete'] as const)('%s /reviews/me', (method) => {
        const mutation = method === 'patch' ? service.updateOwnReview : service.deleteOwnReview;

        it('rejects a request without a session', async () => {
            const res = await request(app)[method](path).set(csrfHeaders).send({ rating: 4 });

            expect(res.status).toBe(401);
            expect(mutation).not.toHaveBeenCalled();
        });

        it('rejects a request without CSRF headers before checking the session', async () => {
            const res = await request(app)[method](path).set('Cookie', 'token=session-token').send({ rating: 4 });

            expect(res.status).toBe(403);
            expect(auth.getUserBySessionToken).not.toHaveBeenCalled();
            expect(mutation).not.toHaveBeenCalled();
        });

        it('rejects an invalid restaurant slug', async () => {
            const res = await request(app)
                [method]('/api/v1/restaurants/Pho-Thin/reviews/me')
                .set(sessionHeaders)
                .send({ rating: 4 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Tham số không hợp lệ');
            expect(mutation).not.toHaveBeenCalled();
        });

        it('returns 404 when the authenticated user has no matching review', async () => {
            mutation.mockResolvedValue(false);

            const res = await request(app)[method](path).set(sessionHeaders).send({ rating: 4 });

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Không tìm thấy đánh giá' });
        });
    });
});
