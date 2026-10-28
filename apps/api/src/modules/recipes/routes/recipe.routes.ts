// Recipe routes: map /api/v1/recipes URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/recipe.controller.js';

export const recipeRouter = Router();

recipeRouter.get('/', asyncHandler(controller.list));
recipeRouter.get('/:slug', asyncHandler(controller.detail));
