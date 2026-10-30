// Article service tests: published-only filter, search and paging with Prisma mocked
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getArticleBySlug, listArticles } from '../services/article.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        article: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.article);
const now = new Date('2026-10-30T12:00:00Z');

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('listArticles', () => {
    it('returns only published articles, newest first, and computes the page offset', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        const result = await listArticles({ page: 2, limit: 5 });

        const where = { publishedAt: { lte: now } };
        expect(db.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where,
                orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
                skip: 5,
                take: 5,
            }),
        );
        expect(db.count).toHaveBeenCalledWith({ where });
        expect(result).toEqual({ items: [], total: 0, page: 2, limit: 5 });
    });

    it('searches the title and summary when q is given', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listArticles({ q: 'phở', page: 1, limit: 12 });

        const where = {
            publishedAt: { lte: now },
            OR: [{ title: { contains: 'phở' } }, { summary: { contains: 'phở' } }],
        };
        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
        expect(db.count).toHaveBeenCalledWith({ where });
    });

    it('never selects the article content or the author email in the list', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listArticles({ page: 1, limit: 12 });

        const { select } = db.findMany.mock.calls[0][0] as { select: Record<string, unknown> };
        expect(select).not.toHaveProperty('contentMd');
        expect(select.author).toEqual({ select: { name: true } });
    });
});

describe('getArticleBySlug', () => {
    it('looks up the slug among published articles only', async () => {
        db.findUnique.mockResolvedValue(null);

        await getArticleBySlug('an-sang-o-ha-noi');

        expect(db.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { slug: 'an-sang-o-ha-noi', publishedAt: { lte: now } } }),
        );
    });

    it('returns null when the article is missing or not published', async () => {
        db.findUnique.mockResolvedValue(null);

        expect(await getArticleBySlug('van-hoa-tra-da-via-he')).toBeNull();
    });
});
