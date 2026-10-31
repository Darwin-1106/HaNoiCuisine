// Itinerary routes: map /api/v1/itineraries URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import * as controller from '../controllers/itinerary.controller.js';

export const itineraryRouter = Router();

itineraryRouter.get('/', asyncHandler(controller.list));
itineraryRouter.get('/:slug', asyncHandler(controller.detail));
