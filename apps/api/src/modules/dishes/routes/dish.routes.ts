// Dish routes: map /api/v1/dishes URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/dish.controller.js';

export const dishRouter = Router();

dishRouter.get('/', asyncHandler(controller.list));
dishRouter.get('/:slug', asyncHandler(controller.detail));
