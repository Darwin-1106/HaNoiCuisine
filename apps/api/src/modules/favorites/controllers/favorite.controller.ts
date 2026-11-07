// Favorite controller: validate requests and manage the current user's favorites
import type { Request, Response } from 'express';
import { z } from 'zod';
import { favoriteParams, listFavoritesQuery } from '../schemas/favorite.schema.js';
import * as service from '../services/favorite.service.js';

export async function save(req: Request, res: Response) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    const params = favoriteParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({
            error: 'Tham số không hợp lệ',
            details: z.flattenError(params.error),
        });
        return;
    }

    const saved = await service.saveFavorite(params.data.slug, req.user.id);
    if (!saved) {
        res.status(404).json({ error: 'Không tìm thấy quán' });
        return;
    }

    res.status(204).end();
}

export async function remove(req: Request, res: Response) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    const params = favoriteParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({
            error: 'Tham số không hợp lệ',
            details: z.flattenError(params.error),
        });
        return;
    }

    await service.removeFavorite(params.data.slug, req.user.id);
    res.status(204).end();
}

export async function list(req: Request, res: Response) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    const query = listFavoritesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({
            error: 'Tham số không hợp lệ',
            details: z.flattenError(query.error),
        });
        return;
    }

    const favorites = await service.listFavorites(req.user.id, query.data);
    res.set('Cache-Control', 'no-store').json(favorites);
}
