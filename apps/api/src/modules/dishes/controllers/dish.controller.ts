// Dish controller: validate request, call service, send HTTP response
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listDishesQuery } from '../schemas/dish.schema.js';
import * as dishService from '../services/dish.service.js';

export async function list(req: Request, res: Response) {
    const parsed = listDishesQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }
    res.json(await dishService.listDishes(parsed.data));
}

export async function detail(req: Request, res: Response) {
    const dish = await dishService.getDishBySlug(req.params.slug);
    if (!dish) {
        res.status(404).json({ error: 'Không tìm thấy món ăn' });
        return;
    }
    res.json(dish);
}
