import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    // This is needed for vite to handle Typescript in svelte components
    preprocess: vitePreprocess({ script: true }),

    vite: {
        server: {
            fs: {
                allow: [],
            },
        },
    },

    kit: {
        version: {
            // Every 10 secs this checks if app was updated
            // updated means build timestamp checking by default
            // see: https://kit.svelte.dev/docs/configuration#version
            // pollInterval: 10000
        },
        adapter: adapter(
            // ---------------- For build ------------------
            {
                pages: 'build/htdocs',
                assets: 'build/htdocs',
                // For SPA this is important. If a dynamic route is requested on a static site,
                // a fallback page is the response which svelte recognizes on the client-side
                // and tries to do client-side dynamic routing. Hosting provider specific option.

                // For test deploy use commented fallback page
                // fallback: 'index.html',
                fallback: 'index.html',
                precompress: false,
                // strict is needed to check if all sites have prerender = true OR have a fallback page(see above)
                strict: true,
            }
        ),
    },
};

export default config;
