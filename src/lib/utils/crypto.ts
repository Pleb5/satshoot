
// https://github.com/paulmillr/noble-ciphers
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { managedNonce } from '@noble/ciphers/webcrypto/utils'
import { utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes } from '@noble/ciphers/utils';

import { scrypt} from '@noble/hashes/scrypt';

export function encryptSecret (secret: string, passphrase: string, salt: string):string {
    const key = scrypt(passphrase, salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32,
        onProgress(percentage: number) {
        },
    });

    const chacha = managedNonce(xchacha20poly1305)(key); 
    const data = utf8ToBytes(secret);
    const cipherData = chacha.encrypt(data);

    return bytesToHex(cipherData);
}

export function decryptSecret(ciphertext: string, passphrase: string, salt: string): string {
    const key = scrypt(passphrase, salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32,
        onProgress(percentage: number) {
        },
    });

    const chacha = managedNonce(xchacha20poly1305)(key); 
    const secretBytes = chacha.decrypt(hexToBytes(ciphertext));
    const decryptedSecret = bytesToUtf8(secretBytes);

    return decryptedSecret;
}

