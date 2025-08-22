import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [sveltekit(), tailwindcss()],
    server: {
        port: 8001,
        host: '0.0.0.0',
    },
    preview: {
        port: 8001,
        host: '0.0.0.0',
    },
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
    },
});
