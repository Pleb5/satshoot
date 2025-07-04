/** @type {import('@sveltejs/kit').ParamMatcher} */

import { NDKKind } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

export function match(param: string) {
    if (/^(naddr1)[a-zA-Z0-9]*/.test(param)) {
        const { type, data } = nip19.decode(param);
        if (type === 'naddr' && (data.kind === NDKKind.FreelanceBid || data.kind === NDKKind.FreelanceOrder)) return true;
    }

    return false;
}
