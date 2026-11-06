// Review routes: require authentication before creating restaurant reviews
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import { requireAuth } from '../../../middlewares/require-auth.js';
import * as controller from '../controllers/review.controller.js';

export const reviewRouter = Router();

reviewRouter.post('/:slug/reviews', asyncHandler(requireAuth), asyncHandler(controller.create));
reviewRouter.patch('/:slug/reviews/me', asyncHandler(requireAuth), asyncHandler(controller.update));
reviewRouter.delete('/:slug/reviews/me', asyncHandler(requireAuth), asyncHandler(controller.remove));
