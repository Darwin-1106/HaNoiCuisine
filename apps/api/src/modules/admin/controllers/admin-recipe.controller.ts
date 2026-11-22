// Handle admin recipe reads
import type { Request, Response } from 'express';
import { z } from 'zod';
import { adminRecipeParams, listAdminRecipesQuery } from '../schemas/admin-recipe.schema.js';
import { getAdminRecipeById, listAdminRecipes } from '../services/admin-recipe.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminRecipesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminRecipes(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}

export async function detail(req: Request, res: Response) {
    const params = adminRecipeParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const recipe = await getAdminRecipeById(params.data.id);
    if (!recipe) {
        res.status(404).json({ error: 'Không tìm thấy công thức' });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ recipe });
}
