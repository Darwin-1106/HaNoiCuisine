// Handle paginated article lists for admins
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listAdminArticles } from '../services/admin-article.service.js';
import { listAdminArticlesQuery } from '../schemas/admin-article.schema.js';

export async function list(req: Request, res: Response) {
    const query = listAdminArticlesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminArticles(query.data);
    res.setHeader('Cache-control', 'no-store').json(result);
}
