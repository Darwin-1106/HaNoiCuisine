// Auth controller: validate request, call service, manage the auth cookie
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { AUTH_COOKIE, readAuthCookie } from '../../../middlewares/require-auth.js';
import { loginBody, registerBody } from '../schemas/auth.schema.js';
import * as authService from '../services/auth.service.js';

const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
};

async function startSession(res: Response, userId: number) {
    const token = await authService.createSession(userId);
    res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: authService.SESSION_TTL_SECONDS * 1000 });
}

export async function register(req: Request, res: Response) {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }

    const user = await authService.register(parsed.data);
    if (!user) {
        res.status(409).json({ error: 'Email đã được sử dụng' });
        return;
    }

    await startSession(res, user.id);
    res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: z.flattenError(parsed.error) });
        return;
    }

    const user = await authService.login(parsed.data);
    if (!user) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        return;
    }

    await startSession(res, user.id);
    res.json({ user });
}

export async function logout(req: Request, res: Response) {
    const token = readAuthCookie(req);
    if (token) {
        await authService.deleteSession(token);
    }
    res.clearCookie(AUTH_COOKIE, cookieOptions);
    res.status(204).end();
}

export function me(req: Request, res: Response) {
    res.json({ user: req.user });
}
