// Handle admin recipe reads and writes
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    adminRecipeParams,
    createAdminRecipeBody,
    listAdminRecipesQuery,
    updateAdminRecipeBody,
} from '../schemas/admin-recipe.schema.js';
import {
    createAdminRecipe,
    getAdminRecipeById,
    listAdminRecipes,
    updateAdminRecipe,
} from '../services/admin-recipe.service.js';

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

function sendRecipeWriteError(res: Response, error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug đã được sử dụng' });
            return;
        }
        if (error.code === 'P2003') {
            res.status(400).json({ error: 'Món ăn không tồn tại' });
            return;
        }
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy công thức' });
            return;
        }
    }

    throw error;
}

export async function create(req: Request, res: Response) {
    const body = createAdminRecipeBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const recipe = await createAdminRecipe(body.data);
        res.set('Cache-Control', 'no-store').status(201).json({ recipe });
    } catch (error) {
        sendRecipeWriteError(res, error);
    }
}

export async function update(req: Request, res: Response) {
    const params = adminRecipeParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = updateAdminRecipeBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const recipe = await updateAdminRecipe(params.data.id, body.data);
        res.set('Cache-Control', 'no-store').json({ recipe });
    } catch (error) {
        sendRecipeWriteError(res, error);
    }
}
