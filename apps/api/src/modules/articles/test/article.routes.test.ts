// Article routes tests: HTTP status codes, query validation and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as articleService from '../services/article.service.js';

vi.mock('../services/article.service.js', () => ({
    listArticles: vi.fn(),
    getArticleBySlug: vi.fn(),
}));

type ArticleDetail = NonNullable<Awaited<ReturnType<typeof articleService.getArticleBySlug>>>;

const service = vi.mocked(articleService);
const app = createApp();

describe('GET /api/v1/articles', () => {
    it('returns the list with default paging', async () => {
        service.listArticles.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        const res = await request(app).get('/api/v1/articles');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(service.listArticles).toHaveBeenCalledWith({ page: 1, limit: 12 });
    });

    it('passes the trimmed search text and paging to the service', async () => {
        service.listArticles.mockResolvedValue({ items: [], total: 0, page: 2, limit: 5 });

        await request(app).get(`/api/v1/articles?q=${encodeURIComponent('  phở ')}&page=2&limit=5`);

        expect(service.listArticles).toHaveBeenCalledWith({ q: 'phở', page: 2, limit: 5 });
    });

    it.each(['q=', 'q=%20%20', 'page=0', 'limit=51', 'page=abc'])('returns 400 for invalid query %s', async (query) => {
        const res = await request(app).get(`/api/v1/articles?${query}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Tham số không hợp lệ');
        expect(service.listArticles).not.toHaveBeenCalled();
    });
});

describe('GET /api/v1/articles/:slug', () => {
    it('returns the article when it is published', async () => {
        const article = {
            title: 'Ăn sáng ở Hà Nội: nên thử gì?',
            slug: 'an-sang-o-ha-noi',
            contentMd: '## Phở',
        } as unknown as ArticleDetail;
        service.getArticleBySlug.mockResolvedValue(article);

        const res = await request(app).get('/api/v1/articles/an-sang-o-ha-noi');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(article);
        expect(service.getArticleBySlug).toHaveBeenCalledWith('an-sang-o-ha-noi');
    });

    it('returns 404 when the article does not exist or is not published', async () => {
        service.getArticleBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/articles/van-hoa-tra-da-via-he');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy bài viết' });
    });
});
