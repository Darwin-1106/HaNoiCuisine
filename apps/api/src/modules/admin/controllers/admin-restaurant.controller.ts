// Handle admin restaurant list and visibility requests
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    adminRestaurantParams,
    listAdminRestaurantsQuery,
    restaurantVisibilityBody,
} from '../schemas/admin-restaurant.schema.js';
import { listAdminRestaurants, setRestaurantVisibility } from '../services/admin-restaurant.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminRestaurantsQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminRestaurants(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}

export async function updateVisibility(req: Request, res: Response) {
    const params = adminRestaurantParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = restaurantVisibilityBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    const restaurant = await setRestaurantVisibility(params.data.id, body.data.published);
    if (!restaurant) {
        res.status(404).json({ error: 'Không tìm thấy quán' });
        return;
    }

    res.json({ restaurant });
}
