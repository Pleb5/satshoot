import NDKSvelte from "@nostr-dev-kit/ndk-svelte";
import { get } from 'svelte/store';

import { localStorageStore } from '@skeletonlabs/skeleton';
import type { Writable } from 'svelte/store';
import { NDKPrivateKeySigner, NDKNip07Signer } from "@nostr-dev-kit/ndk";

export const INITIALRELAYURLS = [
    "wss://purplepag.es/",
    "wss://relay.nostr.band/",
    "wss://nos.lol/",
    "wss://relay.snort.social/",
    "wss://relay.damus.io/",
]

export enum LoginMethod {
    NIP07 = "nip07",
    Ephemeral = "ephemeral",
}


// We need a serializer/deserializer for NDKUser in order to restore it from session-persistent localStorage
function stringifyNDK(ndk: NDKSvelte | null):string {
    if (!ndk) {
        return JSON.stringify(ndk);
    }

    // No helper fn. for NDK so convert relay pool and signer(sigining method, private key) 
    const pool = JSON.stringify(ndk?.pool.urls());
    let method: string | undefined = undefined;
    let pk: string | undefined = undefined;

    if (ndk.signer) {
        console.log(ndk.signer)
        if (ndk.signer instanceof NDKPrivateKeySigner) {
            method = LoginMethod.Ephemeral;
            console.log(pk)
            const signer = ndk.signer as NDKPrivateKeySigner;
            pk = signer.privateKey;
        } else {
            method = LoginMethod.NIP07;
        }
    }

    // Lets pack it up
    let ndkMap = {
        pool: pool ?? '',
        method: method ?? '',
        pk: pk ?? '',
    }; 

    return JSON.stringify(ndkMap); 
}

function parseNDK(userString: string | undefined): NDKSvelte | null {
    if (!userString) {
        return null;
    }

    const ndkMap = JSON.parse(userString);
    
    const ndk = new NDKSvelte({
        enableOutboxModel: false,
        outboxRelayUrls: ["wss://purplepag.es"],
        explicitRelayUrls: JSON.parse(ndkMap['pool']) as string[],
    });

    console.log(ndk)

    const method = ndkMap['method'] as string;

    const pk = ndkMap['pk'] as string;

    if (method) {
        if (method === LoginMethod.Ephemeral && pk) {
            ndk.signer = new NDKPrivateKeySigner(pk);
        } else if (method === LoginMethod.NIP07) {
            ndk.signer = new NDKNip07Signer();
        }
    }
    console.log(ndk)


    return ndk;
}
// Create a singleton instance that is the default export
const ndk: Writable<NDKSvelte | null>
= localStorageStore(
    'ndk',
    null,
    {
        storage:'session',
        serializer: {
            parse: (ndkStr) => parseNDK(ndkStr),
            stringify: (ndk) => stringifyNDK(ndk),
        },
    },
);

export let ndkSvelte:NDKSvelte | null = get(ndk);
if (ndkSvelte && ndkSvelte.signer) {
    await ndkSvelte.connect();
    await ndkSvelte.signer.user();
} else {
    ndkSvelte = new NDKSvelte({
        explicitRelayUrls: INITIALRELAYURLS,
        outboxRelayUrls: ["wss://purplepag.es"],
        enableOutboxModel: false,
    });
    ndk.set(ndkSvelte);
    await ndkSvelte.connect();
}


console.log("NDK Connected");

export default ndk;





