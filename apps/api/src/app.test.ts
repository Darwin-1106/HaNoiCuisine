// App security tests: verify response headers and production-only HTTPS policies
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('Security headers', () => {
    it.each([
        ['/api/v1/health', 200],
        ['/missing-route', 404],
    ] as const)('protects GET %s responses', async (path, status) => {
        const res = await request(createApp()).get(path);

        expect(res.status).toBe(status);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
        expect(res.headers['content-security-policy']).toContain("object-src 'none'");
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('protects malformed JSON responses and preserves CORS', async () => {
        const res = await request(createApp())
            .post('/api/v1/auth/login')
            .set('Origin', 'test-origin')
            .set('Content-Type', 'application/json')
            .send('{bad json');

        expect(res.status).toBe(400);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['access-control-allow-origin']).toBe('test-origin');
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('enables HSTS and HTTPS upgrades in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        const res = await request(createApp()).get('/api/v1/health');

        expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
        expect(res.headers['content-security-policy']).toContain('upgrade-insecure-requests');
        expect(res.body).toEqual({ status: 'ok' });
    });

    it('keeps local HTTP usable in development', async () => {
        vi.stubEnv('NODE_ENV', 'development');

        const res = await request(createApp()).get('/api/v1/health');

        expect(res.headers['strict-transport-security']).toBeUndefined();
        expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
});
