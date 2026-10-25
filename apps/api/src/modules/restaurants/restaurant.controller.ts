// Restaurant controller: validate request, call service, send HTTP response
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listRestaurantsQuery } from './restaurant.schema.js';
import * as restaurantService from './restaurant.service.js';

export async function list(req: Request, res: Response) {
    const parsed = listRestaurantsQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(parsed.error)});
        return;
    }
    res.json(await restaurantService.listRestaurants(parsed.data));
}

export async function detail(req: Request, res: Response) {
    const restaurant = await restaurantService.getRestaurantBySlug(req.params.slug);
    if (!restaurant) {
        res.status(404).json({ error: 'Không tìm thấy quán' });
        return;
    }
    res.json(restaurant);
}
