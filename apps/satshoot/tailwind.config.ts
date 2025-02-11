import { join } from 'path';
import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

import { skeleton } from '@skeletonlabs/tw-plugin';
import { colors } from './colors';

const config = {
    darkMode: 'selector',
    content: [
        './src/**/*.{html,js,svelte,ts}',
        join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}'),
    ],
    theme: {
        extend: {
            colors: colors,
            boxShadow: {
                soft: '0 0 8px rgba(0, 0, 0, 0.25)',
                strong: '0 0 8px 4px rgba(0, 0, 0, 0.5)',
                subtle: '0 0 4px rgba(0, 0, 0, 0.25)',
                deep: '0 0 4px 2px rgba(0, 0, 0, 0.35)',
            },
        },
        fontFamily: {
            sans: [
                // '"Hind", sans-serif',
            ],
        },
    },
    plugins: [
        forms,
        skeleton({
            themes: { preset: ['wintry'] },
        }),
    ],
} satisfies Config;

export default config;
