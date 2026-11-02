// Auth schemas: Zod validation for register and login request bodies
import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(200));

export const registerBody = z.object({
    email,
    password: z.string().min(8).max(128),
    name: z.string().trim().min(1).max(100),
});

export const loginBody = z.object({
    email,
    password: z.string().min(1).max(128),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
