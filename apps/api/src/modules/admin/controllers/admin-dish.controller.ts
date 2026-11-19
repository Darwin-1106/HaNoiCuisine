// Handle admin dish list and detail reads
import type { Request, Response } from 'express';
import { z } from 'zod';
import { adminDishParams, listAdminDishesQuery } from '../schemas/admin-dish.schema.js';
import { getAdminDishById, listAdminDishes } from '../services/admin-dish.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminDishesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminDishes(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}

export async function detail(req: Request, res: Response) {
    const params = adminDishParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const dish = await getAdminDishById(params.data.id);
    if (!dish) {
        res.status(404).json({ error: 'Không tìm thấy món ăn' });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ dish });
}
