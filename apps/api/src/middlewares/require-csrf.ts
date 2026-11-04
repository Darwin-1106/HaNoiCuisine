// CSRF protection: require a trusted origin and custom header for unsafe requests
import type { NextFunction, Request, Response } from 'express';
import { requireEnv } from '../config/env.js';

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        next();
        return;
    }

    if (req.get('Origin') !== requireEnv('CORS_ORIGIN') || req.get('X-CSRF-Protection') !== '1') {
        res.status(403).json({ error: 'Yêu cầu không được phép' });
        return;
    }
    next();
}
