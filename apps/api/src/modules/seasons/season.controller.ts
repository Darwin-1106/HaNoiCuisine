// Season controller: call service and send HTTP response
import type { Request, Response } from 'express';
import * as seasonService from './season.service.js';

export async function list(_req: Request, res: Response) {
    res.json(await seasonService.listSeasons());
}

export async function detail(req: Request, res: Response) {
    const season = await seasonService.getSeasonBySlug(req.params.slug);
    if (!season) {
        res.status(404).json({ error: 'Không tìm thấy mùa' });
        return;
    }
    res.json(season);
}
