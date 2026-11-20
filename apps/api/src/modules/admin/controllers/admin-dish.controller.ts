// Handle admin dish reads and writes
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    adminDishParams,
    createAdminDishBody,
    listAdminDishesQuery,
    updateAdminDishBody,
} from '../schemas/admin-dish.schema.js';
import { createAdminDish, getAdminDishById, listAdminDishes, updateAdminDish } from '../services/admin-dish.service.js';

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

function sendDishWriteError(res: Response, error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug đã được sử dụng' });
            return;
        }
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy món ăn' });
            return;
        }
    }

    throw error;
}

export async function create(req: Request, res: Response) {
    const body = createAdminDishBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const dish = await createAdminDish(body.data);
        res.set('Cache-Control', 'no-store').status(201).json({ dish });
    } catch (error) {
        sendDishWriteError(res, error);
    }
}

export async function update(req: Request, res: Response) {
    const params = adminDishParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = updateAdminDishBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const dish = await updateAdminDish(params.data.id, body.data);
        res.set('Cache-Control', 'no-store').json({ dish });
    } catch (error) {
        sendDishWriteError(res, error);
    }
}
