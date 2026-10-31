// Itinerary routes tests: HTTP status codes, query validation and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as itineraryService from '../services/itinerary.service.js';

vi.mock('../services/itinerary.service.js', () => ({
    listItineraries: vi.fn(),
    getItineraryBySlug: vi.fn(),
}));

type ItineraryDetail = NonNullable<Awaited<ReturnType<typeof itineraryService.getItineraryBySlug>>>;

const service = vi.mocked(itineraryService);
const app = createApp();

describe('GET /api/v1/itineraries', () => {
    it('returns the list with default paging', async () => {
        service.listItineraries.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        const res = await request(app).get('/api/v1/itineraries');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(service.listItineraries).toHaveBeenCalledWith({ page: 1, limit: 12 });
    });

    it('passes parsed paging to the service', async () => {
        service.listItineraries.mockResolvedValue({ items: [], total: 0, page: 2, limit: 5 });

        await request(app).get('/api/v1/itineraries?page=2&limit=5');

        expect(service.listItineraries).toHaveBeenCalledWith({ page: 2, limit: 5 });
    });

    it.each(['page=0', 'limit=51', 'page=abc'])('returns 400 for invalid query %s', async (query) => {
        const res = await request(app).get(`/api/v1/itineraries?${query}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expect(service.listItineraries).not.toHaveBeenCalled();
    });
});

describe('GET /api/v1/itineraries/:slug', () => {
    it('returns the itinerary when it exists', async () => {
        const itinerary = {
            title: '1 ngày ăn gì ở Hà Nội',
            slug: '1-ngay-an-gi-o-ha-noi',
            stops: [],
        } as unknown as ItineraryDetail;
        service.getItineraryBySlug.mockResolvedValue(itinerary);

        const res = await request(app).get('/api/v1/itineraries/1-ngay-an-gi-o-ha-noi');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(itinerary);
        expect(service.getItineraryBySlug).toHaveBeenCalledWith('1-ngay-an-gi-o-ha-noi');
    });

    it('returns 404 when the itinerary does not exist', async () => {
        service.getItineraryBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/itineraries/khong-co');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy lộ trình' });
    });
});
