// Restrict admin routes to authenticated users with the ADMIN role
import type { NextFunction, Request, Response } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        return;
    }

    if (req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Bạn không có quyền truy cập' });
        return;
    }

    next();
}
