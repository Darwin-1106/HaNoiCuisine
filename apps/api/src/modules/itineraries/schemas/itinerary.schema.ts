// Itinerary schemas: Zod validation for request input
import { z } from 'zod';

export const listItinerariesQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListItinerariesQuery = z.infer<typeof listItinerariesQuery>;
