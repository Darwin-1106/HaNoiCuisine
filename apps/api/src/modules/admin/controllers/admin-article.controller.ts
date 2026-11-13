// Handle admin article reads and edits
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
    createAdminArticle,
    getAdminArticleById,
    listAdminArticles,
    updateAdminArticle,
} from '../services/admin-article.service.js';
import {
    adminArticleParams,
    createAdminArticleBody,
    listAdminArticlesQuery,
    updateAdminArticleBody,
} from '../schemas/admin-article.schema.js';

export async function list(req: Request, res: Response) {
    const query = listAdminArticlesQuery.safeParse(req.query);
    if (!query.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(query.error) });
        return;
    }

    const result = await listAdminArticles(query.data);
    res.setHeader('Cache-control', 'no-store').json(result);
}

export async function detail(req: Request, res: Response) {
    const params = adminArticleParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const article = await getAdminArticleById(params.data.id);
    if (!article) {
        res.status(404).json({ error: 'Không tìm thấy bài viết' });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ article });
}

function sendArticleWriteError(res: Response, error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug đã được sử dụng' });
            return;
        }
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy bài viết' });
            return;
        }
    }

    throw error;
}

export async function create(req: Request, res: Response) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    const body = createAdminArticleBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const article = await createAdminArticle(req.user.id, body.data);
        res.set('Cache-Control', 'no-store').status(201).json({ article });
    } catch (error) {
        sendArticleWriteError(res, error);
    }
}

export async function update(req: Request, res: Response) {
    const params = adminArticleParams.safeParse(req.params);
    if (!params.success) {
        res.status(400).json({ error: 'Tham số không hợp lệ', details: z.flattenError(params.error) });
        return;
    }

    const body = updateAdminArticleBody.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(body.error) });
        return;
    }

    try {
        const article = await updateAdminArticle(params.data.id, body.data);
        res.set('Cache-Control', 'no-store').json({ article });
    } catch (error) {
        sendArticleWriteError(res, error);
    }
}
