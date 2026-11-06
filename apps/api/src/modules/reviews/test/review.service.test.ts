// Review service tests: published restaurants, stored fields and duplicate handling
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { createReview, deleteOwnReview, updateOwnReview } from '../services/review.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        restaurant: { findFirst: vi.fn() },
        review: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
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

describe('updateOwnReview', () => {
    it('only updates the owner review of a published restaurant and accepts a cleared comment', async () => {
        reviews.updateMany.mockResolvedValue({ count: 1 });

        await expect(updateOwnReview('pho-thin', 7, { comment: null })).resolves.toBe(true);
        expect(reviews.updateMany).toHaveBeenCalledExactlyOnceWith({
            where: { userId: 7, restaurant: { slug: 'pho-thin', published: true } },
            data: { rating: undefined, comment: null },
        });
    });

    it('returns false when no eligible review matches', async () => {
        reviews.updateMany.mockResolvedValue({ count: 0 });

        await expect(updateOwnReview('pho-thin', 7, { rating: 4 })).resolves.toBe(false);
    });
});

describe('deleteOwnReview', () => {
    it('only deletes the owner review and allows removal from a hidden restaurant', async () => {
        reviews.deleteMany.mockResolvedValue({ count: 1 });

        await expect(deleteOwnReview('pho-thin', 7)).resolves.toBe(true);
        expect(reviews.deleteMany).toHaveBeenCalledExactlyOnceWith({
            where: { userId: 7, restaurant: { slug: 'pho-thin' } },
        });
    });

    it('returns false when the user has no matching review', async () => {
        reviews.deleteMany.mockResolvedValue({ count: 0 });

        await expect(deleteOwnReview('pho-thin', 7)).resolves.toBe(false);
    });
});
