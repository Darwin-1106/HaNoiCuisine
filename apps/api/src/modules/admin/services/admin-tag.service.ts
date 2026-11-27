// Read and write tags for admins with dish and restaurant counts
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../database/prisma.js';
import type { CreateAdminTagBody, ListAdminTagsQuery, UpdateAdminTagBody } from '../schemas/admin-tag.schema.js';

const tagListSelect = {
    id: true,
    name: true,
    slug: true,
    _count: { select: { dishes: true, restaurants: true } },
} satisfies Prisma.TagSelect;

const tagWriteSelect = {
    id: true,
    name: true,
    slug: true,
} satisfies Prisma.TagSelect;

export async function listAdminTags({ page, limit, q }: ListAdminTagsQuery) {
    const where: Prisma.TagWhereInput = q ? { name: { contains: q } } : {};

    const [tags, total] = await Promise.all([
        prisma.tag.findMany({
            where,
            select: tagListSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.tag.count({ where }),
    ]);

    const items = tags.map(({ _count, ...tag }) => ({
        ...tag,
        dishCount: _count.dishes,
        restaurantCount: _count.restaurants,
    }));

    return { items, total, page, limit };
}

export function createAdminTag(body: CreateAdminTagBody) {
    return prisma.tag.create({ data: body, select: tagWriteSelect });
}

export function updateAdminTag(id: number, body: UpdateAdminTagBody) {
    return prisma.tag.update({ where: { id }, data: body, select: tagWriteSelect });
}
