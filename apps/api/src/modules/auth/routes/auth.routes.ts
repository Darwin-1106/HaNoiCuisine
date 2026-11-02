// Auth routes: map /api/v1/auth URLs to controller functions
import { Router } from 'express';
import { asyncHandler } from '../../../middlewares/async-handler.js';
import { loginLimiter, registerLimiter } from '../../../middlewares/auth-rate-limit.js';
import { requireAuth } from '../../../middlewares/require-auth.js';
import * as controller from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, asyncHandler(controller.register));
authRouter.post('/login', loginLimiter, asyncHandler(controller.login));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.get('/me', asyncHandler(requireAuth), controller.me);
