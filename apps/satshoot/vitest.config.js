import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [sveltekit(), svelte({ hot: !process.env.VITEST })],
    resolve: {
        conditions: process.env.VITEST ? ['browser'] : [],
    },
    test: {
        environment: 'jsdom',
        globals: true,
    },
});
