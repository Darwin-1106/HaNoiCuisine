// Require a logged-in user: read the JWT cookie and attach the current user to the request
import type { NextFunction, Request, Response } from 'express';
import { getUserById, verifyToken, type PublicUser } from '../modules/auth/services/auth.service.js';

declare module 'express-serve-static-core' {
    interface Request {
        user?: PublicUser;
    }
}

export const AUTH_COOKIE = 'token';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const userId = verifyToken(req.cookies[AUTH_COOKIE] ?? '');
    const user = userId && (await getUserById(userId));
    if (!user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }
    req.user = user;
    next();
}
