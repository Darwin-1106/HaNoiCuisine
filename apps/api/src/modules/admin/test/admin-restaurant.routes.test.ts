// Verify admin restaurant requests through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        restaurant: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.restaurant);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const cookie = 'token=admin-session';
const headers = { Cookie: cookie, Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/restaurants';

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('Admin restaurants', () => {
    it('lists both visibility states in a stable page without caching', async () => {
        const hidden = {
            id: 3,
            slug: 'pho-thin',
            name: 'Phở Thìn',
            address: 'Hà Nội',
            districtId: 1,
            published: false,
        };
        const visible = { ...hidden, id: 4, slug: 'bun-cha', name: 'Bún chả', published: true };
        db.findMany.mockResolvedValue([hidden, visible] as never);
        db.count.mockResolvedValue(4);

        const res = await request(app)
            .get(path + '?page=2&limit=2')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ items: [hidden, visible], total: 4, page: 2, limit: 2 });
        expect(db.findMany).toHaveBeenCalledExactlyOnceWith({
            select: { id: true, name: true, slug: true, address: true, districtId: true, published: true },
            orderBy: { id: 'asc' },
            skip: 2,
            take: 2,
        });
        expect(db.count).toHaveBeenCalledExactlyOnceWith();
    });

    it.each(['page=0', 'page=10001', 'limit=51'])('rejects invalid pagination %s', async (query) => {
        const res = await request(app)
            .get(path + '?' + query)
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(db.findMany).not.toHaveBeenCalled();
        expect(db.count).not.toHaveBeenCalled();
    });

    it.each([false, true])('sets only published to %s', async (published) => {
        db.update.mockResolvedValue({ id: 3, published } as never);

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant: { id: 3, published } });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { published },
            select: { id: true, published: true },
        });
    });

    it.each(['0', '1e2', '2147483648'])('rejects invalid IDs %s', async (id) => {
        const res = await request(app)
            .patch(path + '/' + id + '/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it.each([{}, { published: 'false' }, { published: false, name: 'Changed' }])(
        'rejects invalid visibility bodies %o',
        async (body) => {
            const res = await request(app)
                .patch(path + '/3/visibility')
                .set(headers)
                .send(body);

            expect(res.status).toBe(400);
            expect(db.update).not.toHaveBeenCalled();
        },
    );

    it('returns 404 when the restaurant does not exist', async () => {
        db.update.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Missing restaurant', { code: 'P2025', clientVersion: 'test' }),
        );

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy quán' });
    });

    it('returns 500 for an unexpected database error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        db.update.mockRejectedValue(new Error('Private database error'));

        const res = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });

    it('rejects a list without a session', async () => {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(db.findMany).not.toHaveBeenCalled();
    });

    it('rejects regular users before reading or writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const list = await request(app).get(path).set('Cookie', cookie);
        const update = await request(app)
            .patch(path + '/3/visibility')
            .set(headers)
            .send({ published: false });

        expect(list.status).toBe(403);
        expect(update.status).toBe(403);
        expect(db.findMany).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });

    it('rejects writes without CSRF headers before looking up the session', async () => {
        const res = await request(app)
            .patch(path + '/3/visibility')
            .set('Cookie', cookie)
            .send({ published: false });

        expect(res.status).toBe(403);
        expect(lookup).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });
});

describe('Admin restaurant writes', () => {
    const body = { name: 'Phở Hà Nội', slug: 'pho-ha-noi', address: 'Hà Nội', districtId: 1 };
    const editPath = path + '/3';

    it('creates a hidden restaurant and normalizes text fields', async () => {
        const restaurant = { id: 3, ...body, published: false };
        db.create.mockResolvedValue(restaurant as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, name: '  Phở Hà Nội  ' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ restaurant });
        expect(db.create).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ data: { ...body, published: false } }),
        );
    });

    it('updates only the fields provided, preserving visibility', async () => {
        const restaurant = { id: 3, ...body, address: 'Địa chỉ mới', published: true };
        db.update.mockResolvedValue(restaurant as never);

        const res = await request(app).patch(editPath).set(headers).send({ address: '  Địa chỉ mới  ' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant });
        expect(db.update).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ where: { id: 3 }, data: { address: 'Địa chỉ mới' } }),
        );
    });

    it.each([
        { ...body, published: true },
        { ...body, slug: 'Phở Hà Nội' },
        { ...body, districtId: '1' },
        { slug: body.slug, address: body.address, districtId: body.districtId },
    ])('rejects invalid create body %o', async (input) => {
        const res = await request(app).post(path).set(headers).send(input);

        expect(res.status).toBe(400);
        expect(db.create).not.toHaveBeenCalled();
    });

    it.each([{}, { published: true }, { name: ' ' }])('rejects invalid update body %o', async (input) => {
        const res = await request(app).patch(editPath).set(headers).send(input);

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('rejects invalid update IDs before writing', async () => {
        const res = await request(app)
            .patch(path + '/2147483648')
            .set(headers)
            .send({ name: body.name });

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it.each([
        ['post', path, 'create', 'P2002', 409, 'Slug đã được sử dụng'],
        ['patch', editPath, 'update', 'P2002', 409, 'Slug đã được sử dụng'],
        ['post', path, 'create', 'P2003', 400, 'Quận không tồn tại'],
        ['patch', editPath, 'update', 'P2003', 400, 'Quận không tồn tại'],
        ['patch', editPath, 'update', 'P2025', 404, 'Không tìm thấy quán'],
    ] as const)('maps %s Prisma error %s (%s, %s) to %i', async (method, url, operation, code, status, error) => {
        db[operation].mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Database constraint failed', { code, clientVersion: 'test' }),
        );

        const res = await request(app)[method](url).set(headers).send(body);

        expect(res.status).toBe(status);
        expect(res.body).toEqual({ error });
        expect(db[operation]).toHaveBeenCalledTimes(1);
    });

    describe.each([
        ['post', path],
        ['patch', editPath],
    ] as const)('%s %s', (method, url) => {
        it('requires a session before writing', async () => {
            const res = await request(app)
                [method](url)
                .set({
                    Origin: headers.Origin,
                    'X-CSRF-Protection': '1',
                })
                .send(body);

            expect(res.status).toBe(401);
            expect(db.create).not.toHaveBeenCalled();
            expect(db.update).not.toHaveBeenCalled();
        });

        it('rejects regular users before writing', async () => {
            lookup.mockResolvedValue({ ...admin, role: 'USER' });

            const res = await request(app)[method](url).set(headers).send(body);

            expect(res.status).toBe(403);
            expect(db.create).not.toHaveBeenCalled();
            expect(db.update).not.toHaveBeenCalled();
        });

        it('requires CSRF headers before writing', async () => {
            const res = await request(app)[method](url).set('Cookie', cookie).send(body);

            expect(res.status).toBe(403);
            expect(lookup).not.toHaveBeenCalled();
            expect(db.create).not.toHaveBeenCalled();
            expect(db.update).not.toHaveBeenCalled();
        });
    });
});

describe('Admin restaurant details', () => {
    const detailPath = path + '/3';
    const base = { name: 'Phở Hà Nội', slug: 'pho-ha-noi', address: 'Hà Nội', districtId: 1 };
    const extraFields = { openHours: '07:00–22:00', phone: '0901234567', description: 'Quán phở Hà Nội' };
    const hidden = { id: 3, ...base, ...extraFields, published: false };
    const extraSelect = { openHours: true, phone: true, description: true };

    it('returns hidden restaurant details with the three editable fields', async () => {
        db.findUnique.mockResolvedValue(hidden as never);

        const res = await request(app).get(detailPath).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant: hidden });
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            select: expect.objectContaining(extraSelect),
        });
    });

    it('prevents storage of the admin detail response', async () => {
        db.findUnique.mockResolvedValue(hidden as never);

        const res = await request(app).get(detailPath).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('returns 404 for a valid ID without a matching restaurant', async () => {
        db.findUnique.mockResolvedValue(null);

        const res = await request(app).get(detailPath).set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy quán' });
    });

    it('rejects invalid IDs before querying Prisma', async () => {
        const res = await request(app)
            .get(path + '/1e2')
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(db.findUnique).not.toHaveBeenCalled();
    });

    it('requires a session to read restaurant details', async () => {
        const res = await request(app).get(detailPath);

        expect(res.status).toBe(401);
        expect(db.findUnique).not.toHaveBeenCalled();
    });

    it('prevents regular users from reading restaurant details', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app).get(detailPath).set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(db.findUnique).not.toHaveBeenCalled();
    });

    it('accepts and returns all three optional fields on creation', async () => {
        db.create.mockResolvedValue(hidden as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({
                ...base,
                ...extraFields,
                openHours: '  07:00–22:00  ',
            });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ restaurant: hidden });
        expect(db.create).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                data: { ...base, ...extraFields, published: false },
                select: expect.objectContaining(extraSelect),
            }),
        );
    });

    it.each([
        [{ openHours: '  08:00–21:00  ' }, { openHours: '08:00–21:00' }],
        [{ phone: null }, { phone: null }],
        [{ description: 'Mô tả mới' }, { description: 'Mô tả mới' }],
    ])('updates a single optional field and leaves omitted fields untouched: %o', async (input, data) => {
        const restaurant = { ...hidden, ...data };
        db.update.mockResolvedValue(restaurant as never);

        const res = await request(app).patch(detailPath).set(headers).send(input);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant });
        expect(db.update).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                where: { id: 3 },
                data,
                select: expect.objectContaining(extraSelect),
            }),
        );
    });

    it.each([{ openHours: ' '.repeat(3) }, { phone: '0'.repeat(31) }, { description: 'x'.repeat(5001) }])(
        'rejects invalid optional fields: %o',
        async (input) => {
            const res = await request(app).patch(detailPath).set(headers).send(input);

            expect(res.status).toBe(400);
            expect(db.update).not.toHaveBeenCalled();
        },
    );
});

describe('Admin restaurant price range', () => {
    const detailPath = path + '/3';
    const base = { name: 'Phở Hà Nội', slug: 'pho-ha-noi', address: 'Hà Nội', districtId: 1 };
    const price = { priceMin: 30_000, priceMax: 60_000 };
    const restaurant = { id: 3, ...base, ...price, published: false };
    const priceSelect = { priceMin: true, priceMax: true };

    it('stores both prices when creating a restaurant and returns the range', async () => {
        db.create.mockResolvedValue(restaurant as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...base, ...price });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ restaurant });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: { ...base, ...price, published: false },
            select: expect.objectContaining(priceSelect),
        });
    });

    it('returns the stored price range in admin details', async () => {
        db.findUnique.mockResolvedValue(restaurant as never);

        const res = await request(app).get(detailPath).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant });
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            select: expect.objectContaining(priceSelect),
        });
    });

    it.each([
        { priceMin: 0, priceMax: 0 },
        { priceMin: null, priceMax: null },
    ])('updates both price fields together: %o', async (data) => {
        const updated = { ...restaurant, ...data };
        db.update.mockResolvedValue(updated as never);

        const res = await request(app).patch(detailPath).set(headers).send(data);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant: updated });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data,
            select: expect.objectContaining(priceSelect),
        });
    });

    it('keeps the existing range when patching other fields', async () => {
        const updated = { ...restaurant, name: 'Phở Hà Nội mới' };
        db.update.mockResolvedValue(updated as never);

        const res = await request(app).patch(detailPath).set(headers).send({ name: updated.name });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ restaurant: updated });
        expect(db.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: { name: updated.name } }));
    });

    it('rejects inverted prices on create before writing', async () => {
        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...base, priceMin: 60_000, priceMax: 30_000 });

        expect(res.status).toBe(400);
        expect(db.create).not.toHaveBeenCalled();
    });

    it.each([
        { priceMin: 30_000 },
        { priceMax: null },
        { priceMin: null, priceMax: 60_000 },
        { priceMin: 60_000, priceMax: 30_000 },
        { priceMin: -1, priceMax: 60_000 },
        { priceMin: 1.5, priceMax: 60_000 },
        { priceMin: '30000', priceMax: 60_000 },
        { priceMin: 0, priceMax: 2_147_483_648 },
    ])('rejects an invalid price range before writing: %o', async (data) => {
        const res = await request(app).patch(detailPath).set(headers).send(data);

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('rejects coordinate fields on create', async () => {
        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...base, lat: 21.028511, lng: 105.804817 });

        expect(res.status).toBe(400);
        expect(db.create).not.toHaveBeenCalled();
    });

    it('rejects coordinate fields on update', async () => {
        const res = await request(app).patch(detailPath).set(headers).send({ lat: 21.028511, lng: 105.804817 });

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });
});
