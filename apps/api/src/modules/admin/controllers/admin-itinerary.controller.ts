// Handle admin itinerary reads and writes
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    adminItineraryParams,
    createAdminItineraryBody,
    listAdminItinerariesQuery,
    updateAdminItineraryBody,
} from '../schemas/admin-itinerary.schema.js';
import {
    createAdminItinerary,
    getAdminItineraryById,
    listAdminItineraries,
    updateAdminItinerary,
} from '../services/admin-itinerary.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminItinerariesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminItineraries(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}

export async function detail(req: Request, res: Response) {
    const params = adminItineraryParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const itinerary = await getAdminItineraryById(params.data.id);
    if (!itinerary) {
        res.status(404).json({ error: 'Không tìm thấy lộ trình' });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ itinerary });
}

function sendItineraryWriteError(res: Response, error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug đã được sử dụng' });
            return;
        }
        if (error.code === 'P2003') {
            res.status(400).json({ error: 'Nhà hàng hoặc món ăn không tồn tại' });
            return;
        }
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy lộ trình' });
            return;
        }
    }

    throw error;
}

export async function create(req: Request, res: Response) {
    const body = createAdminItineraryBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const itinerary = await createAdminItinerary(body.data);
        res.set('Cache-Control', 'no-store').status(201).json({ itinerary });
    } catch (error) {
        sendItineraryWriteError(res, error);
    }
}

export async function update(req: Request, res: Response) {
    const params = adminItineraryParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = updateAdminItineraryBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const itinerary = await updateAdminItinerary(params.data.id, body.data);
        res.set('Cache-Control', 'no-store').json({ itinerary });
    } catch (error) {
        sendItineraryWriteError(res, error);
    }
}
