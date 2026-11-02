// Auth service: registration, login checks and server-side sessions
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { hashPassword, verifyPassword } from './password.js';
import { prisma } from '../../../database/prisma.js';
import type { LoginBody, RegisterBody } from '../schemas/auth.schema.js';

const DUMMY_HASH = hashPassword('dummy-password-for-timing');
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const publicUserSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export async function register({ email, password, name }: RegisterBody): Promise<PublicUser | null> {
    const passwordHash = await hashPassword(password);
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
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !passwordMatches) {
        return null;
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}

export async function createSession(userId: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    await prisma.session.deleteMany({ where: { userId, expiresAt: { lte: new Date(now) } } });
    await prisma.session.create({
        data: { tokenHash: hashToken(token), userId, expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000) },
    });
    return token;
}

export async function getUserBySessionToken(token: string): Promise<PublicUser | null> {
    const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { expiresAt: true, user: { select: publicUserSelect } },
    });
    return session && session.expiresAt > new Date() ? session.user : null;
}

export async function deleteSession(token: string): Promise<void> {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
