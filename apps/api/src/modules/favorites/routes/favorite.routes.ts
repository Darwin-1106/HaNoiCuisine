// Favorite routes: authenticate requests to list, save, and remove favorites
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import { requireAuth } from '../../../middlewares/require-auth.js';
import * as controller from '../controllers/favorite.controller.js';

export const favoriteRouter = Router();

favoriteRouter.get('/favorites', asyncHandler(requireAuth), asyncHandler(controller.list));
favoriteRouter.put('/restaurants/:slug/favorite', asyncHandler(requireAuth), asyncHandler(controller.save));
favoriteRouter.delete('/restaurants/:slug/favorite', asyncHandler(requireAuth), asyncHandler(controller.remove));
