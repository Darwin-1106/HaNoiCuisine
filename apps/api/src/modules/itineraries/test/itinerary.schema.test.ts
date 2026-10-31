// Itinerary schema tests: paging validation rules
import { describe, expect, it } from 'vitest';
import { listItinerariesQuery } from '../schemas/itinerary.schema.js';

describe('listItinerariesQuery', () => {
    it('applies default paging when no parameter is given', () => {
        expect(listItinerariesQuery.parse({})).toEqual({ page: 1, limit: 12 });
    });

    it('converts paging strings from the URL into numbers', () => {
        expect(listItinerariesQuery.parse({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20 });
    });

    it.each([{ page: '0' }, { limit: '0' }, { limit: '51' }, { page: '1.5' }, { page: 'abc' }])(
        'rejects %o',
        (query) => {
            expect(listItinerariesQuery.safeParse(query).success).toBe(false);
        },
    );
});
