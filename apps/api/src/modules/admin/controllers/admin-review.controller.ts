// Handle paginated review lists for admins
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listAdminReviewsQuery } from '../schemas/admin-review.schema.js';
import { listAdminReviews } from '../services/admin-review.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminReviewsQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminReviews(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}
