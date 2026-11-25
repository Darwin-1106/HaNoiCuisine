// Verify admin itinerary creation and updates through the router with Prisma mocked
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../database/prisma.js';
import { getUserBySessionToken } from '../../auth/services/auth.service.js';

vi.mock('../../../database/prisma.js', () => ({
    prisma: {
        itinerary: { create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock('../../auth/services/auth.service.js', () => ({ getUserBySessionToken: vi.fn() }));

const app = createApp();
const db = vi.mocked(prisma.itinerary);
const lookup = vi.mocked(getUserBySessionToken);
const admin = { id: 7, email: 'an@example.com', name: 'An', role: 'ADMIN' as const };
const headers = { Cookie: 'token=admin-session', Origin: 'test-origin', 'X-CSRF-Protection': '1' };
const path = '/api/v1/admin/itineraries';
const editPath = path + '/3';
const detailSelect = {
    id: true,
    title: true,
    slug: true,
    description: true,
    stops: {
        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            orderNo: true,
            timeSlot: true,
            note: true,
            restaurant: { select: { id: true, name: true, slug: true, published: true } },
            dish: { select: { id: true, name: true, slug: true } },
        },
    },
};
const stops = [
    { timeSlot: 'MORNING', restaurantId: 5, note: 'Phở nóng' },
    { timeSlot: 'EVENING', dishId: 2 },
];
const storedStops = [
    { timeSlot: 'MORNING', restaurantId: 5, note: 'Phở nóng', orderNo: 1 },
    { timeSlot: 'EVENING', dishId: 2, orderNo: 2 },
];
const body = {
    title: '1 ngày ăn ở Hà Nội',
    slug: '1-ngay-an-o-ha-noi',
    description: 'Từ sáng đến tối.',
    stops,
};
const stored = {
    id: 3,
    title: '1 ngày ăn ở Hà Nội',
    slug: '1-ngay-an-o-ha-noi',
    description: 'Từ sáng đến tối.',
    stops: [
        {
            id: 20,
            orderNo: 1,
            timeSlot: 'MORNING',
            note: 'Phở nóng',
            restaurant: { id: 5, name: 'Phở Thìn', slug: 'pho-thin', published: true },
            dish: null,
        },
        {
            id: 21,
            orderNo: 2,
            timeSlot: 'EVENING',
            note: null,
            restaurant: null,
            dish: { id: 2, name: 'Chả cá', slug: 'cha-ca' },
        },
    ],
};

function expectNoWrite() {
    expect(db.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
}

function knownError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Database constraint failed', { code, clientVersion: 'test' });
}

beforeEach(() => {
    lookup.mockResolvedValue(admin);
});

describe('POST /api/v1/admin/itineraries', () => {
    it('creates an itinerary with stops numbered in the order sent without caching', async () => {
        db.create.mockResolvedValue(stored as never);

        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, title: '  1 ngày ăn ở Hà Nội  ', stops: [{ ...stops[0], note: ' Phở nóng ' }, stops[1]] });

        expect(res.status).toBe(201);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ itinerary: stored });
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: {
                title: '1 ngày ăn ở Hà Nội',
                slug: '1-ngay-an-o-ha-noi',
                description: 'Từ sáng đến tối.',
                stops: { create: storedStops },
            },
            select: detailSelect,
        });
    });

    it('creates an itinerary with only the required fields and no stops', async () => {
        db.create.mockResolvedValue({ ...stored, description: null, stops: [] } as never);

        const res = await request(app).post(path).set(headers).send({ title: 'Ăn sáng', slug: 'an-sang' });

        expect(res.status).toBe(201);
        expect(db.create).toHaveBeenCalledExactlyOnceWith({
            data: { title: 'Ăn sáng', slug: 'an-sang', stops: { create: [] } },
            select: detailSelect,
        });
    });

    it.each([
        ['a missing title', { title: undefined }],
        ['a blank title', { title: ' ' }],
        ['an invalid slug', { slug: 'Ăn Sáng' }],
        ['a blank description', { description: '  ' }],
        ['a stop without a restaurant or dish', { stops: [{ timeSlot: 'NOON' }] }],
        ['a stop with only null targets', { stops: [{ timeSlot: 'NOON', restaurantId: null, dishId: null }] }],
        ['an unknown time slot', { stops: [{ timeSlot: 'night', dishId: 1 }] }],
        ['a text restaurant id', { stops: [{ timeSlot: 'NOON', restaurantId: '5' }] }],
        ['a zero dish id', { stops: [{ timeSlot: 'NOON', dishId: 0 }] }],
        ['a client order number', { stops: [{ timeSlot: 'NOON', dishId: 1, orderNo: 9 }] }],
        ['a note over 500 characters', { stops: [{ timeSlot: 'NOON', dishId: 1, note: 'a'.repeat(501) }] }],
        ['more than 50 stops', { stops: Array.from({ length: 51 }, () => ({ timeSlot: 'NOON', dishId: 1 })) }],
        ['an unknown field', { id: 9 }],
    ])('rejects a body with %s before writing', async (_case, override) => {
        const res = await request(app)
            .post(path)
            .set(headers)
            .send({ ...body, ...override });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Dữ liệu không hợp lệ');
        expectNoWrite();
    });

    it('returns 409 when the slug is already used', async () => {
        db.create.mockRejectedValue(knownError('P2002'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
    });

    it('returns 400 when a stop points to a missing restaurant or dish', async () => {
        db.create.mockRejectedValue(knownError('P2003'));

        const res = await request(app).post(path).set(headers).send(body);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Nhà hàng hoặc món ăn không tồn tại' });
    });
});

describe('PATCH /api/v1/admin/itineraries/:id', () => {
    it('updates only the title and keeps the stops untouched', async () => {
        db.update.mockResolvedValue(stored as never);

        const res = await request(app).patch(editPath).set(headers).send({ title: '1 ngày ăn ở Hà Nội' });

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toEqual({ itinerary: stored });
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { title: '1 ngày ăn ở Hà Nội' },
            select: detailSelect,
        });
    });

    it('replaces the whole stop list in the same update', async () => {
        db.update.mockResolvedValue(stored as never);

        const res = await request(app).patch(editPath).set(headers).send({ stops });

        expect(res.status).toBe(200);
        expect(db.update).toHaveBeenCalledExactlyOnceWith({
            where: { id: 3 },
            data: { stops: { deleteMany: {}, create: storedStops } },
            select: detailSelect,
        });
    });

    it('removes every stop when an empty list is sent and clears the description', async () => {
        db.update.mockResolvedValue({ ...stored, description: null, stops: [] } as never);

        await request(app).patch(editPath).set(headers).send({ stops: [], description: null });

        expect(db.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { description: null, stops: { deleteMany: {}, create: [] } } }),
        );
    });

    it('returns 404 when the itinerary does not exist', async () => {
        db.update.mockRejectedValue(knownError('P2025'));

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Ăn sáng' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Không tìm thấy lộ trình' });
    });

    it('returns 409 when the new slug is already used', async () => {
        db.update.mockRejectedValue(knownError('P2002'));

        const res = await request(app).patch(editPath).set(headers).send({ slug: 'an-sang' });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Slug đã được sử dụng' });
    });

    it('returns 400 when a new stop points to a missing restaurant or dish', async () => {
        db.update.mockRejectedValue(knownError('P2003'));

        const res = await request(app).patch(editPath).set(headers).send({ stops });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Nhà hàng hoặc món ăn không tồn tại' });
    });

    it.each(['0', '-1', '01', '1.5', 'abc', '2147483648'])('rejects invalid id %s before writing', async (id) => {
        const res = await request(app).patch(`${path}/${id}`).set(headers).send({ title: 'Ăn sáng' });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            error: 'Tham số không hợp lệ',
            details: { fieldErrors: { id: [expect.any(String)] } },
        });
        expectNoWrite();
    });

    it.each([{}, { title: ' ' }, { stops: null }, { stop: [{ timeSlot: 'NOON', dishId: 1 }] }, { slug: 'A B' }])(
        'rejects the update body %o before writing',
        async (update) => {
            const res = await request(app).patch(editPath).set(headers).send(update);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Dữ liệu không hợp lệ');
            expectNoWrite();
        },
    );
});

describe('Admin itinerary write protection', () => {
    it('requires a session before writing', async () => {
        const res = await request(app)
            .post(path)
            .set({ ...headers, Cookie: '' })
            .send(body);

        expect(res.status).toBe(401);
        expectNoWrite();
    });

    it('rejects regular users before writing', async () => {
        lookup.mockResolvedValue({ ...admin, role: 'USER' });

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Ăn sáng' });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Bạn không có quyền truy cập' });
        expectNoWrite();
    });

    it.each([
        ['without the CSRF header', { Cookie: headers.Cookie, Origin: headers.Origin }],
        ['from another origin', { ...headers, Origin: 'https://evil.example' }],
    ])('rejects a request %s before writing', async (_case, requestHeaders) => {
        const res = await request(app).post(path).set(requestHeaders).send(body);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Yêu cầu không được phép' });
        expectNoWrite();
    });

    it('returns a generic server error for an unexpected database error', async () => {
        db.update.mockRejectedValue(new Error('Private database error'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const res = await request(app).patch(editPath).set(headers).send({ title: 'Ăn sáng' });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Lỗi máy chủ' });
    });
});
