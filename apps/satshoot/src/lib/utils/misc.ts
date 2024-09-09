import {nip19} from 'nostr-tools';
import { 
    type NDKTag,
    type Hexpubkey,
    NDKKind,
} from '@nostr-dev-kit/ndk';

export const SatShootPubkey = 'e3244843f8ab6483827e305e5b9d7f61b9eb791aa274d2a36836f3999c767650';

export const bunkerPerms = [
    'get_public_key',
    'get_relays',
    'nip04_encrypt',
    'nip04_decrypt',
    'sign_event:' + NDKKind.TroubleshootTicket.toString(),
    'sign_event:' + NDKKind.TroubleshootOffer.toString(),
    'sign_event:' + NDKKind.Metadata.toString(),
    'sign_event:' + NDKKind.Text.toString(),
    'sign_event:' + NDKKind.EncryptedDirectMessage.toString(),
    'sign_event:' + NDKKind.Review.toString(),
    'sign_event:' + NDKKind.ZapRequest.toString(),
    'sign_event:' + NDKKind.RelayList.toString(),
    'sign_event:' + NDKKind.HttpAuth.toString(),
]

interface SetSerializer {
      stringify: (set: Set<string>) => string,
      parse: (json: string) => Set<string>,
}

interface MapSerializer {
      stringify: (set: Map<string, number>) => string,
      parse: (json: string) => Map<string, number>,
}

export function getSetSerializer(): SetSerializer {

    return {
        stringify: (set: Set<string> | null) => {
            if (!set) return JSON.stringify(null);
            return JSON.stringify(Array.from(set));
        },
        parse: (json: string) => {
            if (json === 'null') return new Set<string>();
            return new Set<string>(JSON.parse(json))
        },
    }
}

export function getMapSerializer(): MapSerializer {
    return {
        stringify: (map: Map<string, number> | null) => {
            if (!map) return JSON.stringify(null);
            return JSON.stringify(Array.from(map.entries()));
        },

        parse: (json: string) => {
            const map: Map<string, number> = new Map();
            const parsedJson = JSON.parse(json);

            if (parsedJson === null) return map;

            const array: Array<string[]> = Array.from(parsedJson);
            array.forEach((elem: string[]) => {
                map.set(elem[0], parseInt(elem[1]));
            });
            return map;
        },
    }
}

export function percentile(arr:number[], val:number) {
    let count = 0;
    arr.forEach(v => {
        if (v < val) {
            count++;
        } else if (v == val) {
            count += 0.5;
        }
    });
    return Math.floor(100 * count / arr.length);
}

export const filterValidPTags = (tags: NDKTag[]) => tags
    .filter((t: NDKTag) => t[0] === 'p')
    .map((t: NDKTag) => t[1])
    .filter((f: Hexpubkey) => {
        try {
            nip19.npubEncode(f);
            return true;
        } catch { return false; }
    });


export function insertThousandSeparator(amount: number) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function isValidURL(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch (_) {
        return false;
    }
}
