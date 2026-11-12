// List draft and published articles for admins
import { prisma } from '../../../database/prisma.js';
import type { ListAdminArticlesQuery } from '../schemas/admin-article.schema.js';

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
