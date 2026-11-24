// Validate admin itinerary list queries and IDs
import { z } from 'zod';

export const listAdminItinerariesQuery = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    q: z.string().trim().min(1).max(100).optional(),
});

export const adminItineraryParams = z.object({
    id: z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number)
        .pipe(z.number().int().max(2_147_483_647)),
});

export type ListAdminItinerariesQuery = z.infer<typeof listAdminItinerariesQuery>;
