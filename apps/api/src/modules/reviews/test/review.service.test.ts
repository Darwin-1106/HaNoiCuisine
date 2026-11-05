// Review service tests: published restaurants, stored fields and duplicate handling
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { createReview } from '../services/review.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        restaurant: { findFirst: vi.fn() },
        review: { create: vi.fn() },
    },
}));

const restaurants = vi.mocked(prisma.restaurant);
const reviews = vi.mocked(prisma.review);

describe('createReview', () => {
    it('does not create a review when no published restaurant matches', async () => {
        restaurants.findFirst.mockResolvedValue(null);

        const result = await createReview('pho-thin', 7, { rating: 5 });

        expect(result).toEqual({ status: 'not_found' });
        expect(restaurants.findFirst).toHaveBeenCalledWith({
            where: { slug: 'pho-thin', published: true },
            select: { id: true },
        });
        expect(reviews.create).not.toHaveBeenCalled();
    });

    it('stores the trusted user ID and selects only public review fields', async () => {
        restaurants.findFirst.mockResolvedValue({ id: 3 } as never);
        const review = {
            id: 1,
            rating: 5,
            comment: 'Ngon',
            createdAt: new Date('2026-01-01'),
            user: { name: 'An' },
        };
        reviews.create.mockResolvedValue(review as never);

        const result = await createReview('pho-thin', 7, {
            rating: 5,
            comment: 'Ngon',
        });

        expect(result).toEqual({ status: 'created', review });
        expect(reviews.create).toHaveBeenCalledWith({
            data: {
                restaurantId: 3,
                userId: 7,
                rating: 5,
                comment: 'Ngon',
            },
            select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                user: { select: { name: true } },
            },
        });
    });

    it('maps a unique constraint violation to duplicate', async () => {
        restaurants.findFirst.mockResolvedValue({ id: 3 } as never);
        reviews.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Duplicate review', {
                code: 'P2002',
                clientVersion: 'test',
            }),
        );

        await expect(createReview('pho-thin', 7, { rating: 5 })).resolves.toEqual({
            status: 'duplicate',
        });
    });

    it('propagates unexpected database errors', async () => {
        restaurants.findFirst.mockResolvedValue({ id: 3 } as never);
        const error = new Error('database unavailable');
        reviews.create.mockRejectedValue(error);

        await expect(createReview('pho-thin', 7, { rating: 5 })).rejects.toBe(error);
    });
});
