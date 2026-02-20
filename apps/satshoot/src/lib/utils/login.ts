import { wordlist } from '@scure/bip39/wordlists/english';

export function parseRelaysFromBunkerUrl(token: string): string[] | undefined {
    let relayURLs: string[] = [];

    const params = token.split('?')[1]?.split('&');
    if (!params || params.length === 0) {
        return undefined;
    }
    params.forEach((param: string) => {
        const paramValue = param.split('=')[1];
        if (paramValue?.startsWith('wss://')) {
            relayURLs.push(paramValue);
        }
    });

    if (relayURLs.length === 0) return undefined;

    for (let i = 0; i < relayURLs.length; i++) {
        if (!relayURLs[i].endsWith('/')) {
            relayURLs[i] += '/';
        }
    }

    console.log(relayURLs);
    return relayURLs;
}

export function parseRemotePubkeyFromBunkerUrl(token: string): string | undefined {
    return token.split('?')[0].replace('bunker://', '');
}

export function parseSecretFromBunkerUrl(token: string): string | undefined {
    const params = token.split('?')[1]?.split('&');
    if (!params || params.length === 0) {
        return undefined;
    }

    let secret: string | undefined = undefined;
    params.forEach((param: string) => {
        const paramName = param.split('=')[0];
        if (paramName === 'secret') secret = param.split('=')[1];
    });

    return secret;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function sanitizeNip46SignerPayload(signerPayload: string): string | null {
    try {
        const parsedPayload: unknown = JSON.parse(signerPayload);
        if (!isObjectRecord(parsedPayload)) return null;

        const nestedPayload = parsedPayload.payload;
        if (isObjectRecord(nestedPayload) && 'secret' in nestedPayload) {
            delete nestedPayload.secret;
        }

        return JSON.stringify(parsedPayload);
    } catch {
        return null;
    }
}

export function validateSingleSeedWord(seedWord: string): boolean {
    return wordlist.includes(seedWord);
}
