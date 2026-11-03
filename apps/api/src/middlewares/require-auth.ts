// Require a logged-in user: read the session cookie and attach the current user to the request
import type { NextFunction, Request, Response } from 'express';
import { getUserBySessionToken, type PublicUser } from '../modules/auth/services/auth.service.js';

declare module 'express-serve-static-core' {
    interface Request {
        user?: PublicUser;
    }
}

export const AUTH_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-token' : 'token';

export function readAuthCookie(req: Request): string | null {
    const token: unknown = req.cookies[AUTH_COOKIE];
    return typeof token === 'string' && token ? token : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = readAuthCookie(req);
    const user = token && (await getUserBySessionToken(token));
    if (!user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    req.user = user;
    next();
}
