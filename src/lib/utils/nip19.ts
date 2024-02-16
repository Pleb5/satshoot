import {nip19} from 'nostr-tools';

export function idFromNaddr(naddr: string) {
    const ndecode = nip19.decode(naddr).data as any;
    return `${ndecode.kind}:${ndecode.pubkey}:${ndecode.identifier}`;
}
