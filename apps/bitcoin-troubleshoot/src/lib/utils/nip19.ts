import {nip19} from 'nostr-tools';

export function idFromNaddr(naddr: string): string {
    try {
        const ndecode = nip19.decode(naddr).data as any;
        // console.log('naddr relay data: ', ndecode.relays)
        return `${ndecode.kind}:${ndecode.pubkey}:${ndecode.identifier}`;
    } catch(e) {
        console.log(e);
        return '';
    }
}

export function relaysFromNaddr(naddr: string): string {
    try {
        const ndecode = nip19.decode(naddr).data as any;
        return `${ndecode.relays}`;
    } catch (e) {
        console.log(e);
        return '';
    }
}

export function privateKeyFromNsec(nsec: string): string|undefined {
    // nip19 can throw all kinds of errors. swallow them and return undefined on failure
    try {
        const hexPrivateKey = nip19.decode(nsec).data as string;
        return hexPrivateKey;
    } catch(e) {
        console.log('Nip19 Error while decoding nsec: ', e);
        return undefined;
    }
}
