import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Generate a new mnemonic seed phrase (BIP39)
 * @param strength - Strength in bits (128, 160, 192, 224, or 256). Default is 128 (12 words)
 */
export function generateMnemonicSeed(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
    const mnemonic = generateMnemonic(wordlist, strength);

    return mnemonic;
}

    if (!validateMnemonicSeed(mnemonic)) {
        throw new Error('Invalid mnemonic seed phrase');
    }

    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    return seed;
}

/**
 * Save mnemonic seed to a file (browser download)
 * @param mnemonic - the mnemonic phrase
 * @param encrypted - Whether to encrypt the mnemonic before saving
 * @param passphrase - Encryption passphrase (required if encrypted is true)
 */
export async function saveMnemonicToFile(mnemonic: string, encrypted: boolean = false, passphrase?: string)
    : Promise<void> {
    const { filename, mimeType } = encrypted ?
        { filename: 'cashu-mnemonic-seed.enc', mimeType: 'application/octet-stream' }
        : { filename: 'cashu-mnemonic-seed.json', mimeType: 'application/json' };

    const content = await createMnemonicSeedData(mnemonic, encrypted, passphrase);
    const blob = new Blob([JSON.stringify(content)], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

export interface MnemonicSeedData {
    encrypted: boolean,
    data: string,
    createdAt: number,
    version: string
}

/**
 * Create the mnemonic data from the mnemonic seed phrase
 * @param mnemonic - the mnemonic phrase
 * @param encrypted - Whether to encrypt the mnemonic
 * @param passphrase - Encryption passphrase (required if encrypted is true)
 * @returns - promise with the mnemonic data in success case
 */
export async function createMnemonicSeedData(mnemonic: string, encrypted: boolean, passphrase?: string)
    : Promise<MnemonicSeedData> {
    let content;

    if (encrypted) {
        if (!passphrase || passphrase.length < 14) {
            throw new Error('Minimum 14 characters required for passphrase');
        }

        // Simple XOR encryption for the browser environment
        // In production, use a proper encryption library like CryptoJS or WebCrypto API
        const encrypted = await encryptMnemonic(mnemonic, passphrase);
        content = {
            encrypted: true,
            data: encrypted,
            createdAt: Date.now(),
            version: '1.0'
        };
    } else {
        content = {
            encrypted: false,
            data: mnemonic,
            createdAt: Date.now(),
            version: '1.0'
        };
    }

    return content;
}

/**
export async function readMnemonicFromFile(file: File, passphrase?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content) as MnemonicSeedData;
                if (isValidSeedData(data)) {
                    let mnemonic = await mnemonicFromSeedData(data, passphrase);
                    resolve(mnemonic);
                } else {
                    console.error('Validation of seed phrase file failed: Object structure does not match the schema.');
                    reject(new Error('Fails seed phrase file validation.'));
                }
            } catch (error) {
                reject(new Error(`Failed to read mnemonic from file: ${error}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Extract mnemonic seed phrase from the mnemonic data. The function decrypts the mnemonic if required and 
 * validates it.
 * @param data - the mnemonic data
 * @param passphrase - the passphrase in case the mnemonic is encrypted
 * @returns - a promise to the mnemonic
 */
export async function mnemonicFromSeedData(data: MnemonicSeedData, passphrase?: string): Promise<string> {
    let mnemonic: string;

    if (data.encrypted) {
        if (!passphrase) {
            throw new Error('Passphrase required for encrypted file');
        }

        mnemonic = await decryptMnemonic(data.data, passphrase);
    } else {
        mnemonic = data.data;
    }

    // Validate the mnemonic before storing
    if (!validateMnemonicSeed(mnemonic)) {
        throw new Error('Invalid mnemonic seed in file');
    }
    return mnemonic;
}

function isValidSeedData(data: MnemonicSeedData): boolean {
    return (typeof data === 'object'
        && typeof data.encrypted === 'boolean'
        && typeof data.data === 'string'
        && typeof data.createdAt === 'number'
        && typeof data.version === 'string'
    );
}

/**
 * Simple encryption using Web Crypto API
 * @param mnemonic - The mnemonic to encrypt
 * @param passphrase - The passphrase for encryption
async function encryptMnemonic(mnemonic: string, passphrase: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);

    // Derive a key from the passphrase
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
        {
        true,
        ['encrypt', 'decrypt']
    );

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
        {
        key,
        data
    );

    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
}
async function decryptMnemonic(encryptedData: string, passphrase: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    // Derive the key from the passphrase
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
        true,
        ['encrypt', 'decrypt']
    );

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
        {
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}
libgit2 1.9.0