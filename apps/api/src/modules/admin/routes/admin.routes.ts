// Protect all admin endpoints with session and role checks
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import { requireAdmin } from '../../../middlewares/require-admin.js';
import { requireAuth } from '../../../middlewares/require-auth.js';

export const adminRouter = Router();

adminRouter.use(asyncHandler(requireAuth), requireAdmin);

adminRouter.get('/status', (_req, res) => {
    res.json({ status: 'ok' });
});
