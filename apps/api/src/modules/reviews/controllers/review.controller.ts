// Review controller: validate input and create a review for the authenticated user
import type { Request, Response } from 'express';
import { z } from 'zod';
import { createReviewBody, reviewParams } from '../schemas/review.schema.js';
import { createReview } from '../services/review.service.js';

export async function create(req: Request, res: Response) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    const params = reviewParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({
            error: 'Tham số không hợp lệ',
            details: z.flattenError(params.error),
        });
        return;
    }

    const body = createReviewBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({
            error: 'Dữ liệu không hợp lệ',
            details: z.flattenError(body.error),
        });
        return;
    }

    const result = await createReview(params.data.slug, req.user.id, body.data);

    if (result.status === 'not_found') {
        res.status(404).json({ error: 'Không tìm thấy quán' });
        return;
    }

    if (result.status === 'duplicate') {
        res.status(409).json({ error: 'Bạn đã đánh giá quán này' });
        return;
    }

    res.status(201).json({ review: result.review });
}
