import {nip19} from 'nostr-tools';
import { bytesToHex } from '@noble/ciphers/utils';
import { NDKKind } from '@nostr-dev-kit/ndk';

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
        const hexPrivateKey = bytesToHex(nip19.decode(nsec).data as Uint8Array);
        return hexPrivateKey;
    } catch(e) {
        console.log('Nip19 Error while decoding nsec: ', e);
        return undefined;
    }
}

export function isFreelanceJobOrServiceURI(naddr: string) {
    try {
        if (/^(naddr1)[a-zA-Z0-9]*/.test(naddr)) {
            const { type, data } = nip19.decode(naddr);
            if (type === 'naddr' && (
                data.kind === NDKKind.FreelanceService ||
                    data.kind === NDKKind.FreelanceJob
            )) return true;
        }
        return false;
    } catch(e) {
        return false;
    }
}

export function isNpubOrNprofile(identifier: string): boolean {
    try {
        // Test for npub format
        if (/^(npub1)[a-zA-Z0-9]*/.test(identifier)) {
            const { type } = nip19.decode(identifier);
            return type === 'npub';
        }
        // Test for nprofile format
        if (/^(nprofile1)[a-zA-Z0-9]*/.test(identifier)) {
            const { type } = nip19.decode(identifier);
            return type === 'nprofile';
        }
        return false;
    } catch(e) {
        return false;
    }
}

export function getPubkeyFromNpubOrNprofile(identifier: string): string | null {
    try {
        const { type, data } = nip19.decode(identifier);
        if (type === 'npub') {
            return data as string;
        } else if (type === 'nprofile') {
            return (data as any).pubkey;
        }
        return null;
    } catch(e) {
        return null;
    }
}
