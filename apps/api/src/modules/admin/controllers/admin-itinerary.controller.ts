// Handle admin itinerary reads
import type { Request, Response } from 'express';
import { z } from 'zod';
import { adminItineraryParams, listAdminItinerariesQuery } from '../schemas/admin-itinerary.schema.js';
import { getAdminItineraryById, listAdminItineraries } from '../services/admin-itinerary.service.js';

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
