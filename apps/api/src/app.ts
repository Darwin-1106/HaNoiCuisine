// Express app: global middleware, module routes, 404 and error handlers
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { requireEnv } from './config/env.js';
import { articleRouter } from './modules/articles/routes/article.routes.js';
import { authRouter } from './modules/auth/routes/auth.routes.js';
import { dishRouter } from './modules/dishes/routes/dish.routes.js';
import { itineraryRouter } from './modules/itineraries/routes/itinerary.routes.js';
import { recipeRouter } from './modules/recipes/routes/recipe.routes.js';
import { restaurantRouter } from './modules/restaurants/routes/restaurant.routes.js';
import { seasonRouter } from './modules/seasons/routes/season.routes.js';

export function createApp() {
    const app = express();

    const isProduction = process.env.NODE_ENV === 'production';
    app.use(
        helmet({
            strictTransportSecurity: isProduction ? undefined : false,
            contentSecurityPolicy: {
                directives: { upgradeInsecureRequests: isProduction ? [] : null },
            },
        }),
    );
    app.use(cors({ origin: requireEnv('CORS_ORIGIN'), credentials: true }));
    app.use(express.json());
    app.use(cookieParser());

    app.get('/api/v1/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    app.use('/api/v1/restaurants', restaurantRouter);
    app.use('/api/v1/dishes', dishRouter);
    app.use('/api/v1/seasons', seasonRouter);
    app.use('/api/v1/recipes', recipeRouter);
    app.use('/api/v1/articles', articleRouter);
    app.use('/api/v1/itineraries', itineraryRouter);
    app.use('/api/v1/auth', authRouter);

    app.use((_req, res) => {
        res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
    });

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof SyntaxError && 'body' in err) {
            res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ' });
            return;
        }
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    });

    return app;
}
