// Recipe routes tests: HTTP status codes, query validation and responses with the service mocked
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as recipeService from '../services/recipe.service.js';

vi.mock('../services/recipe.service.js', () => ({
    listRecipes: vi.fn(),
    getRecipeBySlug: vi.fn(),
}));

type RecipeDetail = NonNullable<Awaited<ReturnType<typeof recipeService.getRecipeBySlug>>>;

const service = vi.mocked(recipeService);
const app = createApp();

describe('GET /api/v1/recipes', () => {
    it('returns the list with default paging', async () => {
        service.listRecipes.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        const res = await request(app).get('/api/v1/recipes');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [], total: 0, page: 1, limit: 12 });
        expect(service.listRecipes).toHaveBeenCalledWith({ page: 1, limit: 12 });
    });

    it('passes parsed filters to the service', async () => {
        service.listRecipes.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12 });

        await request(app).get('/api/v1/recipes?dish=pho-bo&difficulty=hard');

        expect(service.listRecipes).toHaveBeenCalledWith({ dish: 'pho-bo', difficulty: 'HARD', page: 1, limit: 12 });
    });

    it.each(['difficulty=super', 'difficulty=HARD', 'dish=Pho Bo', 'page=0'])(
        'returns 400 for invalid query %s',
        async (query) => {
            const res = await request(app).get(`/api/v1/recipes?${encodeURI(query)}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Tham số không hợp lệ');
            expect(service.listRecipes).not.toHaveBeenCalled();
        },
    );
});

describe('GET /api/v1/recipes/:slug', () => {
    it('returns the recipe when it exists', async () => {
        const recipe = {
            title: 'Cách nấu phở bò Hà Nội',
            slug: 'cach-nau-pho-bo',
            steps: [],
        } as unknown as RecipeDetail;
        service.getRecipeBySlug.mockResolvedValue(recipe);

        const res = await request(app).get('/api/v1/recipes/cach-nau-pho-bo');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(recipe);
        expect(service.getRecipeBySlug).toHaveBeenCalledWith('cach-nau-pho-bo');
    });

    it('returns 404 when the recipe does not exist', async () => {
        service.getRecipeBySlug.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/recipes/khong-co');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy công thức' });
    });
});
