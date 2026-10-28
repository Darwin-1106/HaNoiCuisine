// Recipe controller: validate request, call service, send HTTP response
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listRecipesQuery } from '../schemas/recipe.schema.js';
import * as recipeService from '../services/recipe.service.js';

export async function list(req: Request, res: Response) {
    const parsed = listRecipesQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }
    res.json(await recipeService.listRecipes(parsed.data));
}

export async function detail(req: Request, res: Response) {
    const recipe = await recipeService.getRecipeBySlug(req.params.slug);
    if (!recipe) {
        res.status(404).json({ error: 'Không tìm thấy công thức' });
        return;
    }
    res.json(recipe);
}
