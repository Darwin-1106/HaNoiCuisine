// Auth service: password hashing, user lookup and JWT signing and verification
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../../../config/env.js';
import { prisma } from '../../../database/prisma.js';
import type { LoginBody, RegisterBody } from '../schemas/auth.schema.js';

const BCRYPT_COST = 10;
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);
export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const publicUserSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export async function register({ email, password, name }: RegisterBody): Promise<PublicUser | null> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
        return await prisma.user.create({
            data: { email, name, passwordHash },
            select: publicUserSelect,
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return null;
        }
        throw error;
    }
}

export async function login({ email, password }: LoginBody): Promise<PublicUser | null> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { ...publicUserSelect, passwordHash: true },
    });
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
        return null;
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}

export async function getUserById(id: number): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
}

export function signToken(userId: number): string {
    return jwt.sign({}, requireEnv('JWT_SECRET'), {
        subject: String(userId),
        expiresIn: TOKEN_TTL_SECONDS,
        algorithm: 'HS256',
    });
}

export function verifyToken(token: string): number | null {
    try {
        const payload = jwt.verify(token, requireEnv('JWT_SECRET'), { algorithms: ['HS256'] });
        if (typeof payload === 'string') {
            return null;
        }
        const userId = Number(payload.sub);
        return Number.isInteger(userId) && userId > 0 ? userId : null;
    } catch {
        return null;
    }
}
