// Article controller: validate request, call service, send HTTP response
import type { Request, Response } from 'express';
import { z } from 'zod';
import { listArticlesQuery } from '../schemas/article.schema.js';
import * as articleService from '../services/article.service.js';

export async function list(req: Request, res: Response) {
    const parsed = listArticlesQuery.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }
    res.json(await articleService.listArticles(parsed.data));
}

export async function detail(req: Request, res: Response) {
    const article = await articleService.getArticleBySlug(req.params.slug);
    if (!article) {
        res.status(404).json({ error: 'Không tìm thấy bài viết' });
        return;
    }
    res.json(article);
}
