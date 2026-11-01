// Auth service tests: password hashing, login checks and JWT verification with Prisma mocked
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../database/prisma.js';
import { getUserById, login, register, signToken, TOKEN_TTL_SECONDS, verifyToken } from '../services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        user: {
            create: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

const db = vi.mocked(prisma.user);
const SECRET = 'test-secret';
const publicUser = { id: 1, email: 'an@example.com', name: 'An', role: 'USER' };
const registerData = { email: 'an@example.com', password: 'matkhau123', name: 'An' };

function knownPrismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Prisma error', { code, clientVersion: 'test' });
}

describe('register', () => {
    it('stores a bcrypt hash instead of the password and returns the public user', async () => {
        db.create.mockResolvedValue(publicUser as never);

        const result = await register(registerData);

        const { data } = db.create.mock.calls[0][0];
        expect(data.passwordHash).not.toBe(registerData.password);
        expect(await bcrypt.compare(registerData.password, data.passwordHash)).toBe(true);
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
        const passwordHash = await bcrypt.hash(credentials.password, 4);
        db.findUnique.mockResolvedValue({ ...publicUser, passwordHash } as never);

        expect(await login(credentials)).toEqual(publicUser);
    });

    it('returns null when the password is wrong', async () => {
        const passwordHash = await bcrypt.hash('mat-khau-khac', 4);
        db.findUnique.mockResolvedValue({ ...publicUser, passwordHash } as never);

        expect(await login(credentials)).toBeNull();
    });

    it('still compares a hash when the email does not exist, to keep timing the same', async () => {
        db.findUnique.mockResolvedValue(null);
        const compare = vi.spyOn(bcrypt, 'compare');

        expect(await login(credentials)).toBeNull();
        expect(compare).toHaveBeenCalledTimes(1);
    });
});

describe('getUserById', () => {
    it('never selects the password hash', async () => {
        db.findUnique.mockResolvedValue(publicUser as never);

        expect(await getUserById(1)).toEqual(publicUser);
        expect(db.findUnique.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
    });
});

describe('signToken', () => {
    it('signs only the user id, with the configured lifetime', () => {
        const payload = jwt.verify(signToken(7), SECRET) as jwt.JwtPayload;

        expect(payload.sub).toBe('7');
        expect(payload.exp! - payload.iat!).toBe(TOKEN_TTL_SECONDS);
        expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    });
});

describe('verifyToken', () => {
    it('returns the user id for a token it signed', () => {
        expect(verifyToken(signToken(7))).toBe(7);
    });

    it.each([
        ['an empty string', () => ''],
        ['garbage', () => 'abc'],
        ['a tampered token', () => `${signToken(7)}x`],
        ['an expired token', () => jwt.sign({}, SECRET, { subject: '7', expiresIn: -10 })],
        ['another secret', () => jwt.sign({}, 'other-secret', { subject: '7' })],
        ['an unsigned token', () => jwt.sign({ sub: '7' }, '', { algorithm: 'none' })],
        ['another algorithm', () => jwt.sign({}, SECRET, { subject: '7', algorithm: 'HS512' })],
        ['a missing subject', () => jwt.sign({}, SECRET)],
        ['a non-numeric subject', () => jwt.sign({}, SECRET, { subject: 'abc' })],
        ['a non-positive subject', () => jwt.sign({}, SECRET, { subject: '0' })],
    ])('returns null for %s', (_name, createToken) => {
        expect(verifyToken(createToken())).toBeNull();
    });
});
