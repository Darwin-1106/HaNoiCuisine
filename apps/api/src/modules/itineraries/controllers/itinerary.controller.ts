// Itinerary controller: validate request, call service, send HTTP response
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listItinerariesQuery } from '../schemas/itinerary.schema.js';
import * as itineraryService from '../services/itinerary.service.js';

export async function list(req: Request, res: Response) {
    const parsed = listItinerariesQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }
    res.json(await itineraryService.listItineraries(parsed.data));
}

export async function detail(req: Request, res: Response) {
    const itinerary = await itineraryService.getItineraryBySlug(req.params.slug);
    if (!itinerary) {
        res.status(404).json({ error: 'Không tìm thấy lộ trình' });
        return;
    }
    res.json(itinerary);
}
