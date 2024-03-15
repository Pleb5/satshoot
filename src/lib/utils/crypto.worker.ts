import { encryptSecret, decryptSecret } from "$lib/utils/crypto";

function runEncryptSecret (secret: string, passphrase: string, salt: string) {
    const encryptedSecret = encryptSecret(secret, passphrase, salt); 
    postMessage({encryptedSecret: encryptedSecret});
}

function runDecryptSecret(ciphertext: string, passphrase: string, salt: string) {
    const decryptedSecret = decryptSecret(ciphertext, passphrase, salt);
    postMessage({decryptedSecret: decryptedSecret});
}

onmessage = (m:MessageEvent) => {
    const secret = m.data['secret'];
    const encryptedSecret = m.data['encrpytedSecret'];
    const passphrase = m.data['passphrase'];
    const salt = m.data['salt'];
    if (encryptedSecret && passphrase && salt) {
        runDecryptSecret(encryptedSecret, passphrase, salt);
    } else if(secret && passphrase && salt) {
        runEncryptSecret(secret, passphrase, salt);
    }
};
