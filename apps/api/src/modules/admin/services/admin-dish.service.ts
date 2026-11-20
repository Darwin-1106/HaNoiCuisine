// Read and write dishes for admins with seasons and restaurant counts
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { CreateAdminDishBody, ListAdminDishesQuery, UpdateAdminDishBody } from '../schemas/admin-dish.schema.js';

const dishListSelect = {
    id: true,
    name: true,
    slug: true,
    image: true,
} satisfies Prisma.DishSelect;

const dishWriteSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    originStory: true,
    image: true,
} satisfies Prisma.DishSelect;

const dishDetailSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    originStory: true,
    image: true,
    seasons: {
        orderBy: { seasonId: 'asc' },
        select: { bestMonths: true, season: { select: { id: true, name: true, slug: true } } },
    },
    _count: { select: { restaurants: true } },
} satisfies Prisma.DishSelect;

export async function listAdminDishes({ page, limit, q }: ListAdminDishesQuery) {
    const where: Prisma.DishWhereInput = q ? { name: { contains: q } } : {};

    const [items, total] = await Promise.all([
        prisma.dish.findMany({
            where,
            select: dishListSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.dish.count({ where }),
    ]);

    return { items, total, page, limit };
}

export async function getAdminDishById(id: number) {
    const dish = await prisma.dish.findUnique({ where: { id }, select: dishDetailSelect });
    if (!dish) {
        return null;
    }

    const { _count, ...rest } = dish;
    return { ...rest, restaurantCount: _count.restaurants };
}

export function createAdminDish(body: CreateAdminDishBody) {
    return prisma.dish.create({ data: body, select: dishWriteSelect });
}

export function updateAdminDish(id: number, body: UpdateAdminDishBody) {
    return prisma.dish.update({ where: { id }, data: body, select: dishWriteSelect });
}
