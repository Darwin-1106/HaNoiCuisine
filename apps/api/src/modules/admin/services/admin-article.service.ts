// Read and write articles for admins
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type {
    CreateAdminArticleBody,
    ListAdminArticlesQuery,
    UpdateAdminArticleBody,
} from '../schemas/admin-article.schema.js';

export async function listAdminArticles({ page, limit }: ListAdminArticlesQuery) {
    const [items, total] = await Promise.all([
        prisma.article.findMany({
            select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.article.count(),
    ]);
    return { items, total, page, limit };
}

const articleDetailSelect = {
    id: true,
    title: true,
    slug: true,
    summary: true,
    contentMd: true,
    coverImage: true,
    authorId: true,
    publishedAt: true,
    createdAt: true,
} satisfies Prisma.ArticleSelect;

export function getAdminArticleById(id: number) {
    return prisma.article.findUnique({ where: { id }, select: articleDetailSelect });
}

export function createAdminArticle(authorId: number, body: CreateAdminArticleBody) {
    return prisma.article.create({
        data: { ...body, authorId, publishedAt: null },
        select: articleDetailSelect,
    });
}

export function updateAdminArticle(id: number, body: UpdateAdminArticleBody) {
    return prisma.article.update({ where: { id }, data: body, select: articleDetailSelect });
}

export async function setAdminArticlePublication(id: number, published: boolean) {
    const now = new Date();
    const where: Prisma.ArticleWhereInput = { id };
    if (published) {
        where.OR = [{ publishedAt: null }, { publishedAt: { gt: now } }];
    }

    const { count } = await prisma.article.updateMany({
        where,
        data: { publishedAt: published ? now : null },
    });
    if (count > 0) {
        return true;
    }

    const article = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    return article !== null;
}
