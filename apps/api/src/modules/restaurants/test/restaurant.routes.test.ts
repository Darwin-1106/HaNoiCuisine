// Restaurant routes tests: HTTP status codes, query validation and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as restaurantService from '../services/restaurant.service.js';

vi.mock('../services/restaurant.service.js', () => ({
    listRestaurants: vi.fn(),
    getRestaurantBySlug: vi.fn(),
}));

type RestaurantDetail = NonNullable<Awaited<ReturnType<typeof restaurantService.getRestaurantBySlug>>>;

const service = vi.mocked(restaurantService);
const app = createApp();

describe('GET /api/v1/restaurants', () => {
    it('returns the list with default paging', async () => {
        service.listRestaurants.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        const res = await request(app).get('/api/v1/restaurants');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(service.listRestaurants).toHaveBeenCalledWith({ page: 1, limit: 12 });
    });

    it('passes parsed filters to the service', async () => {
        service.listRestaurants.mockResolvedValue({ items: [], total: 0, page: 2, limit: 5 });

        await request(app).get(
            '/api/v1/restaurants?district=hoan-kiem&dish=pho-bo&q=%20pho%20&maxPrice=60000&page=2&limit=5',
        );

        expect(service.listRestaurants).toHaveBeenCalledWith({
            district: 'hoan-kiem',
            dish: 'pho-bo',
            q: 'pho',
            maxPrice: 60000,
            page: 2,
            limit: 5,
        });
    });

    it.each(['page=abc', 'page=0', 'limit=51', 'maxPrice=-1'])('returns 400 for invalid query %s', async (query) => {
        const res = await request(app).get(`/api/v1/restaurants?${query}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expect(res.body.details.fieldErrors).toBeDefined();
        expect(service.listRestaurants).not.toHaveBeenCalled();
    });

    it('returns 500 without leaking internal errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        service.listRestaurants.mockRejectedValue(new Error('database is down'));

        const res = await request(app).get('/api/v1/restaurants');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('GET /api/v1/restaurants/:slug', () => {
    it('returns the restaurant when it exists', async () => {
        const restaurant = { id: 1, name: 'Phở Thìn', slug: 'pho-thin' } as RestaurantDetail;
        service.getRestaurantBySlug.mockResolvedValue(restaurant);

        const res = await request(app).get('/api/v1/restaurants/pho-thin');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(restaurant);
        expect(service.getRestaurantBySlug).toHaveBeenCalledWith('pho-thin');
    });

    it('returns 404 when the restaurant does not exist', async () => {
        service.getRestaurantBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/restaurants/khong-co');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy quán' });
    });
});

describe('Unknown routes', () => {
    it('returns 404 JSON for paths that do not exist', async () => {
        const res = await request(app).get('/api/v1/khong-ton-tai');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy đường dẫn' });
    });
});
