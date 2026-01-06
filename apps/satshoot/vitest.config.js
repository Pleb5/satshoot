import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
    plugins: [sveltekit(), svelteTesting()],
    resolve: {
        conditions: process.env.VITEST ? ['browser'] : [],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/vitest.setup.ts'],
    },
});
