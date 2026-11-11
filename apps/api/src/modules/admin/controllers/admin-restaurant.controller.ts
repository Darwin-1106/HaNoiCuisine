// Handle admin restaurant list and visibility requests
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    adminRestaurantDishParams,
    adminRestaurantParams,
    createAdminRestaurantBody,
    listAdminRestaurantsQuery,
    restaurantVisibilityBody,
    saveAdminRestaurantDishBody,
    updateAdminRestaurantBody,
} from '../schemas/admin-restaurant.schema.js';
import {
    createAdminRestaurant,
    getAdminRestaurantById,
    listAdminRestaurants,
    saveAdminRestaurantDish,
    setRestaurantVisibility,
    updateAdminRestaurant,
} from '../services/admin-restaurant.service.js';

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

function sendWriteResult(
    res: Response,
    result: Awaited<ReturnType<typeof createAdminRestaurant>>,
    successStatus: 200 | 201,
) {
    switch (result.status) {
        case 'ok':
            res.status(successStatus).json({ restaurant: result.restaurant });
            return;
        case 'duplicate_slug':
            res.status(409).json({ error: 'Slug đã được sử dụng' });
            return;
        case 'invalid_district':
            res.status(400).json({ error: 'Quận không tồn tại' });
            return;
        case 'not_found':
            res.status(404).json({ error: 'Không tìm thấy quán' });
    }
}

export async function create(req: Request, res: Response) {
    const body = createAdminRestaurantBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    const result = await createAdminRestaurant(body.data);
    sendWriteResult(res, result, 201);
}

export async function update(req: Request, res: Response) {
    const params = adminRestaurantParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = updateAdminRestaurantBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    const result = await updateAdminRestaurant(params.data.id, body.data);
    sendWriteResult(res, result, 200);
}

export async function detail(req: Request, res: Response) {
    const params = adminRestaurantParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({
            error: 'Tham số không hợp lệ',
            details: z.flattenError(params.error),
        });
        return;
    }

    const restaurant = await getAdminRestaurantById(params.data.id);
    if (!restaurant) {
        res.status(404).json({ error: 'Không tìm thấy quán' });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ restaurant });
}

export async function saveDish(req: Request, res: Response) {
    const params = adminRestaurantDishParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = saveAdminRestaurantDishBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    const { id, dishId } = params.data;
    const restaurantDish = await saveAdminRestaurantDish(id, dishId, body.data);
    if (restaurantDish === null) {
        res.status(404).json({ error: 'Không tìm thấy quán hoặc món ăn' });
        return;
    }
    res.set('Cache-Control', 'no-store').json({ restaurantDish });
}
