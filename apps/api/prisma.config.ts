// Prisma CLI config: schema, migrations, seed command and database URL
import { defineConfig } from 'prisma/config';

try {
    process.loadEnvFile();
} catch {
    // no .env file: use existing environment variables
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
