import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.js'],
        include: ['./tests/**/*.test.js'],
        globals: true,
        testTimeout: 10000,
        fileParallelism: false,
    },
});
