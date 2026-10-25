// Restaurant routes: map /api/v1/restaurants URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import * as controller from './restaurant.controller.js';

export const restaurantRouter = Router();

restaurantRouter.get('/', asyncHandler(controller.list));
restaurantRouter.get('/:slug', asyncHandler(controller.detail));
