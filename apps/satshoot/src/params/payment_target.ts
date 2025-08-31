/** @type {import('@sveltejs/kit').ParamMatcher} */

import { ExtendedNDKKind } from '$lib/types/ndkKind';
import { nip19 } from 'nostr-tools';

export function match(param: string) {
    if (/^(naddr1)[a-zA-Z0-9]*/.test(param)) {
        const { type, data } = nip19.decode(param);
        if (
            type === 'naddr' &&
            (data.kind === ExtendedNDKKind.FreelanceBid ||
                data.kind === ExtendedNDKKind.FreelanceOrder)
        )
            return true;
    }

    return false;
}
