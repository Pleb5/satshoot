import { persisted } from "svelte-persisted-store";
import { get, writable, type Writable } from 'svelte/store';

export const updated = writable(false);

const updatedAt: Writable<string | null> = persisted('app_updated_at', null, );

const pollInterval = 10_000;

let pollVersionTimeout: NodeJS.Timeout | undefined;

export async function pollUpdated() {
    if (!import.meta.env.DEV) {
        clearTimeout(pollVersionTimeout);

        pollVersionTimeout = setTimeout(pollUpdated, pollInterval);

        try {
            const res = await fetch('/_app/version.json', {
                headers: {
                    pragma: 'no-cache',
                    'cache-control': 'no-cache'
                }
            });

            const data = await res.json();

            if (!res.ok) return;

            // When updateAt is null, app was just downloaded, newest version
            if (!get(updatedAt)) {
                updatedAt.set(data.version);
                return;
            }

            const versionUpdated = (data.version !== get(updatedAt));

            if (versionUpdated) {
                updated.set(true);
                updatedAt.set(data.version);
            } else {
                updated.set(false);
            }
        } catch(e) {
            console.warn('Could NOT poll app version: ', e)
        }
    }
}
