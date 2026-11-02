// Auth rate limits: restrict login and registration requests by client IP
import { rateLimit } from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: { error: 'Bạn đã đăng nhập quá nhiều lần. Vui lòng thử lại sau.' },
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: { error: 'Bạn đã đăng kí quá nhiều lần, vui lòng thử lại sau.' },
});
