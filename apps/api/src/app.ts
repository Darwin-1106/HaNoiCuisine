// Express app: global middleware, module routes, 404 and error handlers
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { requireEnv } from './lib/env.js';
import { dishRouter } from './modules/dishes/dish.routes.js';
import { restaurantRouter } from './modules/restaurants/restaurant.routes.js';
import { seasonRouter } from './modules/seasons/season.routes.js';

export function createApp() {
    const app = express();

    app.use(cors({ origin: requireEnv('CORS_ORIGIN') }));
    app.use(express.json());

    app.get('/api/v1/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    app.use('/api/v1/restaurants', restaurantRouter);
    app.use('/api/v1/dishes', dishRouter);
    app.use('/api/v1/seasons', seasonRouter);

    app.use((_req, res) => {
        res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
    });

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    });

    return app;
}
