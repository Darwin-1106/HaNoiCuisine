// Itinerary service: business logic and database queries (Prisma)
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListItinerariesQuery } from '../schemas/itinerary.schema.js';

const itinerarySummarySelect = {
    title: true,
    slug: true,
    description: true,
    _count: { select: { stops: true } },
} satisfies Prisma.ItinerarySelect;

const itineraryDetailSelect = {
    title: true,
    slug: true,
    description: true,
    stops: {
        orderBy: { orderNo: 'asc' },
        select: {
            orderNo: true,
            timeSlot: true,
            note: true,
            restaurant: {
                select: {
                    name: true,
                    slug: true,
                    address: true,
                    lat: true,
                    lng: true,
                    published: true,
                    district: {
                        select: { name: true },
                    },
                },
            },
            dish: {
                select: {
                    name: true,
                    slug: true,
                },
            },
        },
    },
} satisfies Prisma.ItinerarySelect;

export async function listItineraries(query: ListItinerariesQuery) {
    const { page, limit } = query;

    const [rows, total] = await Promise.all([
        prisma.itinerary.findMany({
            select: itinerarySummarySelect,
            orderBy: {
                id: 'asc',
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.itinerary.count(),
    ]);

    const items = rows.map(({ _count, ...itinerary }) => ({ ...itinerary, stopCount: _count.stops }));
    return { items, total, page, limit };
}

export async function getItineraryBySlug(slug: string) {
    const itinerary = await prisma.itinerary.findUnique({
        where: { slug },
        select: itineraryDetailSelect,
    });
    if (!itinerary) {
        return null;
    }

    const stops = itinerary.stops.map(({ restaurant, ...stop }) => {
        if (!restaurant?.published) {
            return { ...stop, restaurant: null };
        }
        const { published: _published, ...publicRestaurant } = restaurant;
        return { ...stop, restaurant: publicRestaurant };
    });
    return { ...itinerary, stops };
}
