// Password hashing and verification with Argon2id (RFC 9106 parameters)
import { argon2id, hash, verify, type HashOptions } from 'argon2';

const ARGON2_OPTIONS = { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 } satisfies HashOptions;

export function hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password);
}
