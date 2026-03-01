import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/lib/**/*.ts', 'src/lib/**/*.tsx'],
            exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
        },
        setupFiles: ['./src/test-setup.ts'],
    },
});
