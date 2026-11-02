// Auth service tests: password hashing, login checks and session storage with Prisma mocked
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import {
    createSession,
    deleteSession,
    getUserBySessionToken,
    login,
    register,
    SESSION_TTL_SECONDS,
} from '../services/auth.service.js';
import { hashPassword, verifyPassword } from '../services/password.js';

vi.mock('../services/password.js', { spy: true });
vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        user: {
            create: vi.fn(),
            findUnique: vi.fn(),
        },
        session: {
            create: vi.fn(),
            findUnique: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.user);
const sessions = vi.mocked(prisma.session);
const publicUser = { id: 1, email: 'an@example.com', name: 'An', role: 'USER' };
const registerData = { email: 'an@example.com', password: 'matkhau123', name: 'An' };

function sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function knownPrismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Prisma error', { code, clientVersion: 'test' });
}

describe('register', () => {
    it('stores an Argon2id hash instead of the password and returns the public user', async () => {
        db.create.mockResolvedValue(publicUser as never);

        const result = await register(registerData);

        const { data } = db.create.mock.calls[0][0];
        expect(data.passwordHash).toMatch(/^\$argon2id\$/);
        expect(await verifyPassword(registerData.password, data.passwordHash)).toBe(true);
        expect(result).toEqual(publicUser);
    });

    it('writes only the email, name and hash, and never selects the hash', async () => {
        db.create.mockResolvedValue(publicUser as never);

        await register({ ...registerData, role: 'ADMIN' } as never);

        const { data, select } = db.create.mock.calls[0][0];
        expect(Object.keys(data).sort()).toEqual(['email', 'name', 'passwordHash']);
        expect(select).not.toHaveProperty('passwordHash');
    });

    it('returns null when the email is already taken', async () => {
        db.create.mockRejectedValue(knownPrismaError('P2002'));

        expect(await register(registerData)).toBeNull();
    });

    it('rethrows any other database error', async () => {
        const error = knownPrismaError('P2010');
        db.create.mockRejectedValue(error);

        await expect(register(registerData)).rejects.toBe(error);
    });
});

describe('login', () => {
    const credentials = { email: 'an@example.com', password: 'matkhau123' };

    it('returns the user without the hash when the password matches', async () => {
        const passwordHash = await hashPassword(credentials.password);
        db.findUnique.mockResolvedValue({ ...publicUser, passwordHash } as never);

        expect(await login(credentials)).toEqual(publicUser);
    });

    it('returns null when the password is wrong', async () => {
        const passwordHash = await hashPassword('mat-khau-khac');
        db.findUnique.mockResolvedValue({ ...publicUser, passwordHash } as never);

        expect(await login(credentials)).toBeNull();
    });

    it('still compares a hash when the email does not exist, to keep timing the same', async () => {
        db.findUnique.mockResolvedValue(null);

        expect(await login(credentials)).toBeNull();
        expect(verifyPassword).toHaveBeenCalledTimes(1);
    });
});

describe('createSession', () => {
    it('stores only a hash of a long random token, with the configured lifetime', async () => {
        vi.useFakeTimers({ now: new Date('2026-11-02T00:00:00Z') });

        const token = await createSession(7);

        const { data } = sessions.create.mock.calls[0][0];
        expect(token).toMatch(/^[\w-]{43}$/);
        expect(data.userId).toBe(7);
        expect(data.tokenHash).toBe(sha256(token));
        expect(data.expiresAt).toEqual(new Date(Date.now() + SESSION_TTL_SECONDS * 1000));
        vi.useRealTimers();
    });

    it('creates a different token each time', async () => {
        expect(await createSession(7)).not.toBe(await createSession(7));
    });

    it('removes the expired sessions of that user only', async () => {
        await createSession(7);

        const { where } = sessions.deleteMany.mock.calls[0][0]!;
        expect(where?.userId).toBe(7);
        expect(where?.expiresAt).toEqual({ lte: expect.any(Date) });
    });
});

describe('getUserBySessionToken', () => {
    it('looks up the hash of the token and returns the public user', async () => {
        const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
        sessions.findUnique.mockResolvedValue({ expiresAt: inOneHour, user: publicUser } as never);

        expect(await getUserBySessionToken('token-goc')).toEqual(publicUser);
        const { where, select } = sessions.findUnique.mock.calls[0][0];
        expect(where).toEqual({ tokenHash: sha256('token-goc') });
        expect(select?.user).not.toHaveProperty('select.passwordHash');
    });

    it('returns null when the session does not exist', async () => {
        sessions.findUnique.mockResolvedValue(null);

        expect(await getUserBySessionToken('khong-co')).toBeNull();
    });

    it('returns null when the session has expired', async () => {
        const justExpired = new Date(Date.now() - 1000);
        sessions.findUnique.mockResolvedValue({ expiresAt: justExpired, user: publicUser } as never);

        expect(await getUserBySessionToken('token-goc')).toBeNull();
    });
});

describe('deleteSession', () => {
    it('deletes only the session matching the token hash', async () => {
        await deleteSession('token-goc');

        expect(sessions.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: sha256('token-goc') } });
    });
});
