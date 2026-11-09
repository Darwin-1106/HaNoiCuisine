// List restaurants for admins and change visibility without deleting data
import { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { ListAdminRestaurantsQuery } from '../schemas/admin-restaurant.schema.js';

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
