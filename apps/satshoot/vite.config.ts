import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
// import path from 'path';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    resolve: {
        alias: {
            // '@': path.resolve(__dirname, './src')
        },
    },
});
