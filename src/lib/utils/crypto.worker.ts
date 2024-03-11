import { encryptSeed, decryptSeed } from "$lib/utils/crypto";

function runEncryptSeed (seed: string, passphrase: string, salt: string) {
    const encryptedSeed = encryptSeed(seed, passphrase, salt); 
    postMessage({encryptedSeed: encryptedSeed});
}

function runDecryptSeed(ciphertext: string, passphrase: string, salt: string) {
    const decryptedSeed = decryptSeed(ciphertext, passphrase, salt);
    postMessage({decryptedSeed: decryptedSeed});
}

onmessage = (m:MessageEvent) => {
    const seed = m.data['seed'];
    const encryptedSeed = m.data['encrpytedSeed'];
    const passphrase = m.data['passphrase'];
    const salt = m.data['salt'];
    if (encryptedSeed && passphrase && salt) {
        runDecryptSeed(encryptedSeed, passphrase, salt);
    } else if(seed && passphrase && salt) {
        runEncryptSeed(seed, passphrase, salt);
    }
};
