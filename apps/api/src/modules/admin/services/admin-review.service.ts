// Read paginated reviews for admins with limited author information
import { prisma } from '../../../database/prisma.js';
import type { ListAdminReviewsQuery } from '../schemas/admin-review.schema.js';

export async function listAdminReviews({ page, limit }: ListAdminReviewsQuery) {
    const [items, total] = await Promise.all([
        prisma.review.findMany({
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                restaurant: { select: { id: true, name: true, slug: true } },
                user: { select: { name: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.review.count(),
    ]);

    return { items, total, page, limit };
}

export async function deleteAdminReview(id: number): Promise<boolean> {
    const { count } = await prisma.review.deleteMany({ where: { id } });
    return count > 0;
}
