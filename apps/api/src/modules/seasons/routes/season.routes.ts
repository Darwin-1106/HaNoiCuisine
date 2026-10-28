// Season routes: map /api/v1/seasons URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/season.controller.js';

export const seasonRouter = Router();

seasonRouter.get('/', asyncHandler(controller.list));
seasonRouter.get('/:slug', asyncHandler(controller.detail));
