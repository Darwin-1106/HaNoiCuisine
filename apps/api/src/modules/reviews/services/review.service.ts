// Review service: create reviews for published restaurants and handle duplicates
import { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { CreateReviewBody } from '../schemas/review.schema.js';

export async function createReview(slug: string, userId: number, body: CreateReviewBody) {
    const restaurant = await prisma.restaurant.findFirst({
        where: { slug, published: true },
        select: { id: true },
    });

    if (!restaurant) {
        return { status: 'not_found' as const };
    }

    try {
        const review = await prisma.review.create({
            data: {
                restaurantId: restaurant.id,
                userId,
                rating: body.rating,
                comment: body.comment,
            },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: { select: { name: true } },
            },
        });

        return { status: 'created' as const, review };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { status: 'duplicate' as const };
        }

        throw error;
    }
}
