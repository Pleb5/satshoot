// https://github.com/paulmillr/noble-ciphers
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { managedNonce } from '@noble/ciphers/webcrypto/utils'
import { utf8ToBytes, bytesToUtf8, bytesToHex, hexToBytes } from '@noble/ciphers/utils';

import { scryptAsync } from '@noble/hashes/scrypt';

export async function encryptSeed (seed: string, passphrase: string, salt: string):Promise<string> {
    const key = await scryptAsync(passphrase, salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32,
        onProgress(percentage: number) {
            console.log('key derivation in progress: ', percentage);
        },
    });

    const chacha = managedNonce(xchacha20poly1305)(key); 
    const data = utf8ToBytes(seed);
    const cipherData = chacha.encrypt(data);

    return bytesToHex(cipherData);
}

export async function decryptSeed(ciphertext: string, passphrase: string, salt: string): Promise<string> {
    const key = await scryptAsync(passphrase, salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32,
        onProgress(percentage: number) {
            console.log('key derivation in progress: ', percentage);
        },
    });

    const chacha = managedNonce(xchacha20poly1305)(key); 
    const seedBytes = chacha.decrypt(hexToBytes(ciphertext));
    const decryptedSeed = bytesToUtf8(seedBytes);
    console.log(decryptedSeed);
    return decryptedSeed;
}
