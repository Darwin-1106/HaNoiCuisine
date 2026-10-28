// Restaurant routes: map /api/v1/restaurants URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/restaurant.controller.js';

export const restaurantRouter = Router();

restaurantRouter.get('/', asyncHandler(controller.list));
restaurantRouter.get('/:slug', asyncHandler(controller.detail));
