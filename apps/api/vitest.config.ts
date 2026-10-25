// Vitest config: Node environment, co-located *.test.ts files, isolated test env vars (no .env)
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        env: {
            CORS_ORIGIN: 'test-origin',
        },
        mockReset: true,
        restoreMocks: true,
    },
});
