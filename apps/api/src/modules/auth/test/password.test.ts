// Password tests: Argon2id parameters, verification and long multi-byte passwords
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../services/password.js';

describe('hashPassword', () => {
    it('uses Argon2id with the configured cost', async () => {
        expect(await hashPassword('matkhau123')).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
    });

    it('produces a different hash each time', async () => {
        expect(await hashPassword('matkhau123')).not.toBe(await hashPassword('matkhau123'));
    });
});

describe('verifyPassword', () => {
    it('accepts the right password and rejects a wrong one', async () => {
        const passwordHash = await hashPassword('matkhau123');

        expect(await verifyPassword('matkhau123', passwordHash)).toBe(true);
        expect(await verifyPassword('matkhau124', passwordHash)).toBe(false);
    });

    it('checks every character of a long multi-byte password', async () => {
        const prefix = 'ệ'.repeat(100);
        const passwordHash = await hashPassword(`${prefix}A`);

        expect(await verifyPassword(`${prefix}A`, passwordHash)).toBe(true);
        expect(await verifyPassword(`${prefix}B`, passwordHash)).toBe(false);
    });

    it('rejects a hash from another algorithm', async () => {
        const bcryptHash = '$2a$04$abcdefghijklmnopqrstuuJ0sVbJ9nM4lqJcT7bJ8rVbqYk3m2uWe';

        expect(await verifyPassword('matkhau123', bcryptHash)).toBe(false);
    });
});
