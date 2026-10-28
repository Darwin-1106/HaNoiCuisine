// Recipe service tests: Prisma query building and the stepsJson to steps mapping with Prisma mocked
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getRecipeBySlug, listRecipes } from '../services/recipe.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        recipe: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.recipe);

describe('listRecipes', () => {
    it('combines dish and difficulty filters and computes the page offset', async () => {
        db.findMany.mockResolvedValue([]);
        db.count.mockResolvedValue(0);

        await listRecipes({ dish: 'pho-bo', difficulty: 'HARD', page: 2, limit: 5 });

        const where = { dish: { slug: 'pho-bo' }, difficulty: 'HARD' };
        expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 5, take: 5 }));
        expect(db.count).toHaveBeenCalledWith({ where });
    });
});

describe('getRecipeBySlug', () => {
    it('returns null when the recipe does not exist', async () => {
        db.findUnique.mockResolvedValue(null);

        expect(await getRecipeBySlug('khong-co')).toBeNull();
    });

    it('replaces stepsJson with a validated steps array', async () => {
        db.findUnique.mockResolvedValue({ title: 'Phở bò', stepsJson: ['Bước 1', 'Bước 2'] } as never);

        const result = await getRecipeBySlug('cach-nau-pho-bo');

        expect(result).toEqual({ title: 'Phở bò', steps: ['Bước 1', 'Bước 2'] });
    });

    it('throws when stored steps are not a list of strings', async () => {
        db.findUnique.mockResolvedValue({ title: 'Phở bò', stepsJson: { broken: true } } as never);

        await expect(getRecipeBySlug('cach-nau-pho-bo')).rejects.toThrow();
    });
});
