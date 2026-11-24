// Read itineraries for admins with their ordered stops
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListAdminItinerariesQuery } from '../schemas/admin-itinerary.schema.js';

const itineraryListSelect = {
    id: true,
    title: true,
    slug: true,
    _count: { select: { stops: true } },
} satisfies Prisma.ItinerarySelect;

const itineraryDetailSelect = {
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
} satisfies Prisma.ItinerarySelect;

export async function listAdminItineraries({ page, limit, q }: ListAdminItinerariesQuery) {
    const where: Prisma.ItineraryWhereInput = q ? { title: { contains: q } } : {};

    const [rows, total] = await Promise.all([
        prisma.itinerary.findMany({
            where,
            select: itineraryListSelect,
            orderBy: [{ title: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.itinerary.count({ where }),
    ]);

    const items = rows.map(({ _count, ...itinerary }) => ({ ...itinerary, stopCount: _count.stops }));
    return { items, total, page, limit };
}

export async function getAdminItineraryById(id: number) {
    return prisma.itinerary.findUnique({ where: { id }, select: itineraryDetailSelect });
}
