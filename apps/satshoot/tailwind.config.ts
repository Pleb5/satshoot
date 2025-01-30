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
