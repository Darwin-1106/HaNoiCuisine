// Article service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListArticlesQuery } from '../schemas/article.schema.js';

const articleSummarySelect = {
    title: true,
    slug: true,
    summary: true,
    coverImage: true,
    publishedAt: true,
    author: { select: { name: true } },
} satisfies Prisma.ArticleSelect;

const articleDetailSelect = {
    ...articleSummarySelect,
    contentMd: true,
} satisfies Prisma.ArticleSelect;

export async function listArticles(query: ListArticlesQuery) {
    const { q, page, limit } = query;

    const where: Prisma.ArticleWhereInput = {
        publishedAt: { lte: new Date() },
        ...(q && { OR: [{ title: { contains: q } }, { summary: { contains: q } }] }),
    };

    const [items, total] = await Promise.all([
        prisma.article.findMany({
            where,
            select: articleSummarySelect,
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.article.count({ where }),
    ]);

    return { items, total, page, limit };
}

export async function getArticleBySlug(slug: string) {
    return prisma.article.findUnique({
        where: { slug, publishedAt: { lte: new Date() } },
        select: articleDetailSelect,
    });
}
