// Season routes tests: HTTP status codes and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as seasonService from '../services/season.service.js';

vi.mock('../services/season.service.js', () => ({
    listSeasons: vi.fn(),
    getSeasonBySlug: vi.fn(),
}));

type SeasonDetail = NonNullable<Awaited<ReturnType<typeof seasonService.getSeasonBySlug>>>;

const service = vi.mocked(seasonService);
const app = createApp();

describe('GET /api/v1/seasons', () => {
    it('returns every season with its dish count', async () => {
        const seasons = [
            { name: 'Xuân', slug: 'xuan', dishCount: 1 },
            { name: 'Đông', slug: 'dong', dishCount: 3 },
        ];
        service.listSeasons.mockResolvedValue(seasons);

        const res = await request(app).get('/api/v1/seasons');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(seasons);
    });

    it('returns 500 without leaking internal errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        service.listSeasons.mockRejectedValue(new Error('database is down'));

        const res = await request(app).get('/api/v1/seasons');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('GET /api/v1/seasons/:slug', () => {
    it('returns the season with its dishes when it exists', async () => {
        const season = { name: 'Đông', slug: 'dong', dishes: [] } as SeasonDetail;
        service.getSeasonBySlug.mockResolvedValue(season);

        const res = await request(app).get('/api/v1/seasons/dong');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(season);
        expect(service.getSeasonBySlug).toHaveBeenCalledWith('dong');
    });

    it('returns 404 when the season does not exist', async () => {
        service.getSeasonBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/seasons/khong-co');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy mùa' });
    });
});
