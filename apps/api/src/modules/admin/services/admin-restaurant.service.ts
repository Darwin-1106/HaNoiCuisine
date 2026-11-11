// List restaurants for admins and change visibility without deleting data
import { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type {
    CreateAdminRestaurantBody,
    ListAdminRestaurantsQuery,
    UpdateAdminRestaurantBody,
} from '../schemas/admin-restaurant.schema.js';

export async function listAdminRestaurants({ page, limit }: ListAdminRestaurantsQuery) {
    const [items, total] = await Promise.all([
        prisma.restaurant.findMany({
            select: { id: true, name: true, slug: true, address: true, districtId: true, published: true },
            orderBy: { id: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.restaurant.count(),
    ]);

    return { items, total, page, limit };
}

export async function setRestaurantVisibility(id: number, published: boolean) {
    try {
        return await prisma.restaurant.update({
            where: { id },
            data: { published },
            select: { id: true, published: true },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return null;
        }

        throw error;
    }
}

const restaurantWriteSelect = {
    id: true,
    name: true,
    slug: true,
    address: true,
    districtId: true,
    openHours: true,
    phone: true,
    description: true,
    published: true,
} satisfies Prisma.RestaurantSelect;

function handleRestaurantWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return { status: 'duplicate_slug' as const };
        if (error.code === 'P2003') return { status: 'invalid_district' as const };
        if (error.code === 'P2025') return { status: 'not_found' as const };
    }

    throw error;
}

export async function createAdminRestaurant(body: CreateAdminRestaurantBody) {
    try {
        const restaurant = await prisma.restaurant.create({
            data: { ...body, published: false },
            select: restaurantWriteSelect,
        });

        return { status: 'ok' as const, restaurant };
    } catch (error) {
        return handleRestaurantWriteError(error);
    }
}

export async function updateAdminRestaurant(id: number, body: UpdateAdminRestaurantBody) {
    try {
        const restaurant = await prisma.restaurant.update({
            where: { id },
            data: body,
            select: restaurantWriteSelect,
        });

        return { status: 'ok' as const, restaurant };
    } catch (error) {
        return handleRestaurantWriteError(error);
    }
}

export function getAdminRestaurantById(id: number) {
    return prisma.restaurant.findUnique({
        where: { id },
        select: restaurantWriteSelect,
    });
}
