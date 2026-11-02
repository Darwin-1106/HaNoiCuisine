// Auth routes tests: status codes, cookie attributes and requireAuth with the service mocked
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import * as authService from '../services/auth.service.js';

vi.mock('../services/auth.service.js', () => ({
    SESSION_TTL_SECONDS: 604800,
    register: vi.fn(),
    login: vi.fn(),
    createSession: vi.fn(),
    getUserBySessionToken: vi.fn(),
    deleteSession: vi.fn(),
}));

let service = vi.mocked(authService);
let app = createApp();
const user = { id: 1, email: 'an@example.com', name: 'An', role: 'USER' as const };
const registerData = { email: 'an@example.com', password: 'matkhau123', name: 'An' };
const credentials = { email: 'an@example.com', password: 'matkhau123' };

function authCookie(res: request.Response) {
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    return cookies?.find((cookie) => cookie.startsWith('token='));
}

beforeEach(async () => {
    vi.resetModules();

    const { createApp: createFreshApp } = await import('../../../app.js');
    service = vi.mocked(await import('../services/auth.service.js'));
    app = createFreshApp();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('POST /api/v1/auth/register', () => {
    it('creates the user, returns 201 and sets a protected cookie', async () => {
        service.register.mockResolvedValue(user);
        service.createSession.mockResolvedValue('session-token');

        const res = await request(app).post('/api/v1/auth/register').send(registerData);

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ user });
        expect(service.createSession).toHaveBeenCalledWith(user.id);
        const cookie = authCookie(res);
        expect(cookie).toContain('token=session-token');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).toContain('Path=/');
        expect(cookie).toContain('Max-Age=604800');
    });

    it('passes only the validated fields to the service', async () => {
        service.register.mockResolvedValue(user);
        service.createSession.mockResolvedValue('session-token');

        await request(app)
            .post('/api/v1/auth/register')
            .send({ ...registerData, email: ' An@Example.COM', role: 'ADMIN' });

        expect(service.register).toHaveBeenCalledWith(registerData);
    });

    it('returns 409 without a cookie when the email is taken', async () => {
        service.register.mockResolvedValue(null);

        const res = await request(app).post('/api/v1/auth/register').send(registerData);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Email đã được sử dụng' });
        expect(authCookie(res)).toBeUndefined();
    });

    it.each([{ email: 'not-an-email' }, { password: 'ngan' }, { name: '' }])(
        'returns 400 for invalid data %o',
        async (override) => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ ...registerData, ...override });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expect(service.register).not.toHaveBeenCalled();
        },
    );

    it('never echoes the password in validation errors', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...registerData, email: 'not-an-email', password: 'mat-khau-bi-mat' });

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).not.toContain('mat-khau-bi-mat');
    });
});

describe('POST /api/v1/auth/login', () => {
    it('returns the user and sets the cookie when the credentials are valid', async () => {
        service.login.mockResolvedValue(user);
        service.createSession.mockResolvedValue('session-token');

        const res = await request(app).post('/api/v1/auth/login').send(credentials);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ user });
        expect(authCookie(res)).toContain('token=session-token');
    });

    it('returns 401 without a cookie when the credentials are wrong', async () => {
        service.login.mockResolvedValue(null);

        const res = await request(app).post('/api/v1/auth/login').send(credentials);

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Email hoặc mật khẩu không đúng' });
        expect(authCookie(res)).toBeUndefined();
    });

    it('returns 400 when the body is missing', async () => {
        const res = await request(app).post('/api/v1/auth/login');

        expect(res.status).toBe(400);
        expect(service.login).not.toHaveBeenCalled();
    });

    it('returns 400, not 500, for malformed JSON', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .set('Content-Type', 'application/json')
            .send('{bad json');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Dữ liệu JSON không hợp lệ' });
    });

    it('returns 500 when the service fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        service.login.mockRejectedValue(new Error('database down'));

        const res = await request(app).post('/api/v1/auth/login').send(credentials);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});

describe('POST /api/v1/auth/logout', () => {
    it('deletes the session on the server, clears the cookie and returns 204', async () => {
        const res = await request(app).post('/api/v1/auth/logout').set('Cookie', 'token=session-token');

        expect(res.status).toBe(204);
        expect(service.deleteSession).toHaveBeenCalledWith('session-token');
        const cookie = authCookie(res);
        expect(cookie).toContain('token=;');
        expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('still clears the cookie when there is no session', async () => {
        const res = await request(app).post('/api/v1/auth/logout');

        expect(res.status).toBe(204);
        expect(service.deleteSession).not.toHaveBeenCalled();
        expect(authCookie(res)).toContain('token=;');
    });
});

describe('GET /api/v1/auth/me', () => {
    it('returns the current user when the session is valid', async () => {
        service.getUserBySessionToken.mockResolvedValue(user);

        const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'token=session-token');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ user });
        expect(service.getUserBySessionToken).toHaveBeenCalledWith('session-token');
    });

    it('returns 401 without a cookie', async () => {
        const res = await request(app).get('/api/v1/auth/me');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Bạn chưa đăng nhập' });
        expect(service.getUserBySessionToken).not.toHaveBeenCalled();
    });

    it('returns 401 when the session is unknown or expired', async () => {
        service.getUserBySessionToken.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'token=bad-token');

        expect(res.status).toBe(401);
    });

    it('returns 401, not 500, when the cookie parses to an object', async () => {
        const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'token=j:{"a":1}');

        expect(res.status).toBe(401);
        expect(service.getUserBySessionToken).not.toHaveBeenCalled();
    });

    it('returns 500 when the session lookup fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        service.getUserBySessionToken.mockRejectedValue(new Error('database down'));

        const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'token=session-token');

        expect(res.status).toBe(500);
    });
});

describe('Secure cookie attribute', () => {
    // cookieOptions reads NODE_ENV when the controller is first loaded, so each case needs a fresh import
    async function loginWithNodeEnv(nodeEnv: string) {
        vi.stubEnv('NODE_ENV', nodeEnv);
        vi.resetModules();
        const { createApp: createFreshApp } = await import('../../../app.js');
        const freshService = vi.mocked(await import('../services/auth.service.js'));
        freshService.login.mockResolvedValue(user);
        freshService.createSession.mockResolvedValue('session-token');

        return request(createFreshApp()).post('/api/v1/auth/login').send(credentials);
    }

    it('is set in production', async () => {
        const res = await loginWithNodeEnv('production');

        expect(authCookie(res)).toContain('Secure');
    });

    it('is not set outside production', async () => {
        const res = await loginWithNodeEnv('development');

        expect(authCookie(res)).not.toContain('Secure');
    });

    it('is also set when the cookie is cleared in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.resetModules();
        const { createApp: createFreshApp } = await import('../../../app.js');

        const res = await request(createFreshApp()).post('/api/v1/auth/logout');

        expect(authCookie(res)).toContain('Secure');
    });
});

describe('Auth rate limits', () => {
    it('blocks the eleventh login request before calling the service', async () => {
        service.login.mockResolvedValue(null);

        for (let attempt = 0; attempt < 10; attempt++) {
            const res = await request(app).post('/api/v1/auth/login').send(credentials);

            expect(res.status).toBe(401);
        }

        const blocked = await request(app).post('/api/v1/auth/login').send(credentials);

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({
            error: 'Bạn đã đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
        });
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
        expect(blocked.headers['ratelimit']).toBeDefined();
        expect(authCookie(blocked)).toBeUndefined();
        expect(service.login).toHaveBeenCalledTimes(10);
        expect(service.createSession).not.toHaveBeenCalled();
    });

    it('blocks the sixth registration request before calling the service', async () => {
        service.register.mockResolvedValue(null);

        for (let attempt = 0; attempt < 5; attempt++) {
            const res = await request(app).post('/api/v1/auth/register').send(registerData);

            expect(res.status).toBe(409);
        }

        const blocked = await request(app).post('/api/v1/auth/register').send(registerData);

        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({
            error: 'Bạn đã đăng kí quá nhiều lần, vui lòng thử lại sau.',
        });
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
        expect(authCookie(blocked)).toBeUndefined();
        expect(service.register).toHaveBeenCalledTimes(5);
        expect(service.createSession).not.toHaveBeenCalled();
    });

    it('keeps registration and logout available when login is rate limited', async () => {
        service.login.mockResolvedValue(null);
        service.register.mockResolvedValue(user);
        service.createSession.mockResolvedValue('session-token');

        for (let attempt = 0; attempt < 10; attempt++) {
            await request(app).post('/api/v1/auth/login').send(credentials);
        }

        const blocked = await request(app).post('/api/v1/auth/login').send(credentials);
        expect(blocked.status).toBe(429);

        const registered = await request(app).post('/api/v1/auth/register').send(registerData);
        expect(registered.status).toBe(201);

        const loggedOut = await request(app).post('/api/v1/auth/logout');
        expect(loggedOut.status).toBe(204);
    });
});
