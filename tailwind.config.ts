import { join } from 'path';
import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

import { skeleton } from '@skeletonlabs/tw-plugin';

				
const config = {
	// 2. Opt for dark mode to be handled via the class method
	darkMode: 'class',
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		join(require.resolve(
			'@skeletonlabs/skeleton'),
			'../**/*.{html,js,svelte,ts}'
		)
	],
	theme: {
		extend: {},
        fontFamily: {
            sans: [
                // '"Hind", sans-serif',
            ]
        },
	},
	plugins: [
        forms,
        skeleton({
            themes: { preset: [ "wintry" ] }
        }),
	]
} satisfies Config;

export default config;

