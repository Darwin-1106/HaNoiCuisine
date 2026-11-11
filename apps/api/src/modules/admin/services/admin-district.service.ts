// List districts for the admin restaurant form
import { prisma } from '../../../database/prisma.js';

export function listAdminDistricts() {
    return prisma.district.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
    });
}
