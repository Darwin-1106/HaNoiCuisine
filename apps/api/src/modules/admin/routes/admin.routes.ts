// Protect all admin endpoints with session and role checks
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import { requireAdmin } from '../../../middlewares/require-admin.js';
import { requireAuth } from '../../../middlewares/require-auth.js';
import * as restaurantController from '../controllers/admin-restaurant.controller.js';
import * as districtController from '../controllers/admin-district.controller.js';

export const adminRouter = Router();

adminRouter.use(asyncHandler(requireAuth), requireAdmin);

adminRouter.get('/status', (_req, res) => {
    res.json({ status: 'ok' });
});

adminRouter.get('/restaurants', asyncHandler(restaurantController.list));
adminRouter.get('/restaurants/:id', asyncHandler(restaurantController.detail));
adminRouter.patch('/restaurants/:id/visibility', asyncHandler(restaurantController.updateVisibility));
adminRouter.post('/restaurants', asyncHandler(restaurantController.create));
adminRouter.patch('/restaurants/:id', asyncHandler(restaurantController.update));
adminRouter.get('/districts', asyncHandler(districtController.list));
adminRouter.put('/restaurants/:id/dishes/:dishId', asyncHandler(restaurantController.saveDish));
adminRouter.delete('/restaurants/:id/dishes/:dishId', asyncHandler(restaurantController.removeDish));
