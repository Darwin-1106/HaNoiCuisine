// Article routes: map /api/v1/articles URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/article.controller.js';

export const articleRouter = Router();

articleRouter.get('/', asyncHandler(controller.list));
articleRouter.get('/:slug', asyncHandler(controller.detail));
