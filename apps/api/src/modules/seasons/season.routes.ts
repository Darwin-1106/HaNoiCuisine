// Season routes: map /api/v1/seasons URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import * as controller from './season.controller.js';

export const seasonRouter = Router();

seasonRouter.get('/', asyncHandler(controller.list));
seasonRouter.get('/:slug', asyncHandler(controller.detail));
