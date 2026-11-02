// Auth schema tests: email normalisation, password length limits and dropping unknown fields
import { describe, expect, it } from 'vitest';
import { loginBody, registerBody } from '../schemas/auth.schema.js';

const validRegister = { email: 'an@example.com', password: 'matkhau123', name: 'An' };

describe('registerBody', () => {
    it('normalises the email and trims the name', () => {
        const result = registerBody.parse({ ...validRegister, email: '  An@Example.COM ', name: ' An ' });

        expect(result.email).toBe('an@example.com');
        expect(result.name).toBe('An');
    });

    it('drops unknown fields such as role', () => {
        expect(registerBody.parse({ ...validRegister, role: 'ADMIN' })).toEqual(validRegister);
    });

    it.each([8, 128])('accepts a password of %i characters', (length) => {
        expect(registerBody.safeParse({ ...validRegister, password: 'a'.repeat(length) }).success).toBe(true);
    });

    it.each([
        { email: 'not-an-email' },
        { email: `${'a'.repeat(200)}@example.com` },
        { password: 'a'.repeat(7) },
        { password: 'a'.repeat(129) },
        { name: '   ' },
        { name: 'a'.repeat(101) },
    ])('rejects %o', (override) => {
        expect(registerBody.safeParse({ ...validRegister, ...override }).success).toBe(false);
    });

    it.each(['email', 'password', 'name'])('requires %s', (field) => {
        const body: Record<string, string> = { ...validRegister };
        delete body[field];

        expect(registerBody.safeParse(body).success).toBe(false);
    });
});

describe('loginBody', () => {
    it('normalises the email', () => {
        expect(loginBody.parse({ email: ' An@Example.COM', password: 'x' }).email).toBe('an@example.com');
    });

    it('accepts a password shorter than the registration minimum', () => {
        expect(loginBody.safeParse({ email: 'an@example.com', password: 'x' }).success).toBe(true);
    });

    it.each([
        { email: 'an@example.com', password: '' },
        { email: 'an@example.com', password: 'a'.repeat(129) },
        { email: 'not-an-email', password: 'matkhau123' },
    ])('rejects %o', (body) => {
        expect(loginBody.safeParse(body).success).toBe(false);
    });
});
