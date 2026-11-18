// Handle paginated review lists and review removal for admins
import type { Request, Response } from 'express';
import { z } from 'zod';
import { adminReviewParams, listAdminReviewsQuery } from '../schemas/admin-review.schema.js';
import { deleteAdminReview, listAdminReviews } from '../services/admin-review.service.js';

export async function list(req: Request, res: Response) {
    const query = listAdminReviewsQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminReviews(query.data);
    res.set('Cache-Control', 'no-store').json(result);
}

export async function remove(req: Request, res: Response) {
    const params = adminReviewParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const deleted = await deleteAdminReview(params.data.id);
    if (!deleted) {
        res.status(404).json({ error: 'Không tìm thấy đánh giá' });
        return;
    }
    res.set('Cache-Control', 'no-store').status(204).end();
}
