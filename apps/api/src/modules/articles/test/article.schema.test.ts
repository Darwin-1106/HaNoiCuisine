// Article schema tests: search text and paging validation rules
import { describe, expect, it } from 'vitest';
import { listArticlesQuery } from '../schemas/article.schema.js';

describe('listArticlesQuery', () => {
    it('applies default paging when no parameter is given', () => {
        expect(listArticlesQuery.parse({})).toEqual({ page: 1, limit: 12 });
    });

    it('converts paging strings from the URL into numbers', () => {
        expect(listArticlesQuery.parse({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20 });
    });

    it('trims the search text', () => {
        expect(listArticlesQuery.parse({ q: '  phở  ' }).q).toBe('phở');
    });

    it.each([{ q: '' }, { q: '   ' }, { q: 'a'.repeat(101) }, { page: '0' }, { limit: '51' }, { page: '1.5' }])(
        'rejects %o',
        (query) => {
            expect(listArticlesQuery.safeParse(query).success).toBe(false);
        },
    );
});
