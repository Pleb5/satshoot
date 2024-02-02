import { localStorageStore } from '@skeletonlabs/skeleton';

import type { Writable } from 'svelte/store';

import { NDKUser, NDKPrivateKeySigner, NDKNip07Signer } from "@nostr-dev-kit/ndk";
import NDKSvelte from '@nostr-dev-kit/ndk-svelte';

export enum LoginMethod {
    NIP07 = "nip07",
    Ephemeral = "ephemeral",
}

// We need a serializer/deserializer for NDKUser in order to restore it from session-persistent localStorage
function stringifyNDKUser(user: NDKUser | null):string {
    if (!user) {
        return JSON.stringify(user);
    }

    // No helper fn. for NDK so convert relay pool and signer(sigining method, private key) 
    const pool = JSON.stringify(user.ndk?.pool.urls());
    let method: string | undefined = undefined;
    let pk: string | undefined = undefined;

    if (user.ndk && user.ndk.signer) {
        console.log(user.ndk.signer)
        if (user.ndk.signer instanceof NDKPrivateKeySigner) {
            method = LoginMethod.Ephemeral;
            console.log(pk)
            const signer = user.ndk.signer as NDKPrivateKeySigner;
            pk = signer.privateKey;
        } else {
            method = LoginMethod.NIP07;
        }
    }



    // Lets pack it up
    let userMap = {
        npub: user.npub,
        pubkey: user.pubkey,
        relayUrls: JSON.stringify(user.relayUrls),
        pool: pool ?? '',
        method: method ?? '',
        pk: pk ?? '',
    }; 

    return JSON.stringify(userMap); 
}

function parseNDKUser(userString: string | undefined): NDKUser | null {
    if (!userString) {
        return null;
    }

    const userMap = JSON.parse(userString);
    
    const ndk = new NDKSvelte({
        enableOutboxModel: false,
        explicitRelayUrls: JSON.parse(userMap['pool']) as string[],
    });

    const method = userMap['method'] as string;

    const pk = userMap['pk'] as string;

    if (method) {
        if (method === LoginMethod.Ephemeral && pk) {
            ndk.signer = new NDKPrivateKeySigner(pk);
        } else if (method === LoginMethod.NIP07) {
            ndk.signer = new NDKNip07Signer();
        }
    }
    console.log(ndk)

    let user:NDKUser; 

    if (userMap['npub'] && userMap['pubkey'] && userMap['relayUrls']) {
        user = new NDKUser({
            npub: userMap['npub'] as string,
            pubkey: userMap['pubkey'] as string,
            relayUrls: JSON.parse(userMap['relayUrls']) as string[],
        });
    } else {
        throw Error('Failed to deserialize User! Missing essential information!');
    }

    user.ndk = ndk;

    console.log(user.ndk)


    return user;
}

// The current User with its ndk instance will be persisted during a page session 
// using local session storage and made available to all pages, despite page refreshes.
// Downside is that now user private key is vulnerable to XSS
// during a session.
// Only when the page session is ended(tab or window closed) will it be stored
// only in encrypted form using persistent 'local' storage policy

const currentUser: Writable<NDKUser | null>
= localStorageStore(
    'currentUser',
    null,
    {
        storage:'session',
        serializer: {
            parse: (userStr) => parseNDKUser(userStr),
            stringify: (user) => stringifyNDKUser(user),
         },
    },
);

export default currentUser;
