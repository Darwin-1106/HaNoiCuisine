// Recipe schema tests: query validation rules and the difficulty transform
import { describe, expect, it } from 'vitest';
import { listRecipesQuery, recipeSteps } from '../schemas/recipe.schema.js';

describe('listRecipesQuery', () => {
    it('applies default paging when no parameter is given', () => {
        expect(listRecipesQuery.parse({})).toEqual({ page: 1, limit: 12 });
    });

    it('converts a lowercase difficulty into the database enum value', () => {
        expect(listRecipesQuery.parse({ difficulty: 'hard' }).difficulty).toBe('HARD');
    });

    it.each(['pho-bo', 'banh-cuon', 'com'])('accepts the slug %s', (dish) => {
        expect(listRecipesQuery.safeParse({ dish }).success).toBe(true);
    });

    it.each(['Pho Bo', 'pho--bo', '-pho', 'phở'])('rejects the slug %s', (dish) => {
        expect(listRecipesQuery.safeParse({ dish }).success).toBe(false);
    });
});

describe('recipeSteps', () => {
    it('accepts a list of strings', () => {
        expect(recipeSteps.safeParse(['Bước 1', 'Bước 2']).success).toBe(true);
    });

    it('rejects anything else', () => {
        expect(recipeSteps.safeParse({ broken: true }).success).toBe(false);
    });
});
