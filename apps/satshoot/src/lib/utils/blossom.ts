import { NDKEvent, NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
import { calculateSha256 } from './crypto';
import { get } from 'svelte/store';
import ndk from '$lib/stores/session';

export async function uploadToBlossom(file: File, blossomUrl: string): Promise<string> {
    const authHeader = await generateAuthHeader(file);

    const res = await fetch(`${blossomUrl}/upload`, {
        method: 'PUT',
        headers: {
            Authorization: authHeader,
        },
        body: file,
    });

    const json = await res.json();
    return json.url;
}

export async function checkIfAlreadyUploaded(file: File, blossomUrl: string) {
    const hash = await calculateSha256(file);
    const res = await fetch(`${blossomUrl}/${hash}`, {
        method: 'HEAD',
    });

    // The HEAD /<sha256> endpoint MUST respond with either a 200 or 404 status code
    // For further info see: https://github.com/hzrd149/blossom/blob/master/buds/01.md#head-sha256---has-blob
    return res.status === 200;
}

export async function generateAuthHeader(file: File) {
    const hash = await calculateSha256(file);
    const event = new NDKEvent(get(ndk), {
        kind: NDKKind.BlossomUpload,
        content: 'Authorize Upload',
        tags: [
            ['t', 'upload'],
            ['x', hash],
            ['expiration', String(Math.floor(Date.now() / 1000) + 60 * 5)], // Set expiration time to 5 minutes from now
            ['name', file.name],
            ['size', String(file.size)],
        ],
    } as NostrEvent);

    await event.sign();

    return 'Nostr ' + btoa(JSON.stringify(event.rawEvent()));
}
