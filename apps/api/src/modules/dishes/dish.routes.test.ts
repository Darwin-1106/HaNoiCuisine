// Dish routes tests: HTTP status codes, query validation and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as dishService from './dish.service.js';

vi.mock('./dish.service.js', () => ({
    listDishes: vi.fn(),
    getDishBySlug: vi.fn(),
}));

type DishDetail = NonNullable<Awaited<ReturnType<typeof dishService.getDishBySlug>>>;

const service = vi.mocked(dishService);
const app = createApp();

describe('GET /api/v1/dishes', () => {
    it('returns the list with default paging', async () => {
        service.listDishes.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        const res = await request(app).get('/api/v1/dishes');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(service.listDishes).toHaveBeenCalledWith({ page: 1, limit: 12 });
    });

    it('passes parsed filters to the service', async () => {
        service.listDishes.mockResolvedValue({ items: [], total: 0, page: 2, limit: 6 });

        await request(app).get('/api/v1/dishes?season=dong&tag=mon-nuoc&q=%20pho%20&page=2&limit=6');

        expect(service.listDishes).toHaveBeenCalledWith({
            season: 'dong',
            tag: 'mon-nuoc',
            q: 'pho',
            page: 2,
            limit: 6,
        });
    });

    it.each(['season=Mùa Đông', 'tag=-bad-', 'page=0', 'limit=51', `q=${'a'.repeat(101)}`])(
        'returns 400 for invalid query %s',
        async (query) => {
            const res = await request(app).get(`/api/v1/dishes?${encodeURI(query)}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Tham số không hợp lệ');
            expect(res.body.details.fieldErrors).toBeDefined();
            expect(service.listDishes).not.toHaveBeenCalled();
        },
    );

    it('returns 500 without leaking internal errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        service.listDishes.mockRejectedValue(new Error('database is down'));

        const res = await request(app).get('/api/v1/dishes');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('GET /api/v1/dishes/:slug', () => {
    it('returns the dish when it exists', async () => {
        const dish = { id: 1, name: 'Phở bò', slug: 'pho-bo' } as DishDetail;
        service.getDishBySlug.mockResolvedValue(dish);

        const res = await request(app).get('/api/v1/dishes/pho-bo');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(dish);
        expect(service.getDishBySlug).toHaveBeenCalledWith('pho-bo');
    });

    it('returns 404 when the dish does not exist', async () => {
        service.getDishBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/dishes/khong-co');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy món ăn' });
    });
});
