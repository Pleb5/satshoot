/**
 * NUT-13: Deterministic Secrets
 * Implementation of mnemonic seed management for Cashu wallets
 * Spec: https://github.com/cashubtc/nuts/blob/main/13.md
 */

import type { NDKUser } from '@nostr-dev-kit/ndk';
import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Generate a new mnemonic seed phrase (BIP39)
 * @param strength - Strength in bits (128, 160, 192, 224, or 256). Default is 128 (12 words)
 * @returns The generated mnemonic phrase
 */
export function generateMnemonicSeed(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
    const mnemonic = generateMnemonic(wordlist, strength);

    return mnemonic;
}

/**
 * Validate a mnemonic seed phrase
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if valid, false otherwise
 */
export function validateMnemonicSeed(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
}

/**
 * Derive the master key from a mnemonic seed
 * @param mnemonic - The mnemonic phrase
 * @param passphrase - Optional BIP39 passphrase
 * @returns HDKey instance for the master key
 */
export function deriveSeedKey(mnemonic: string, passphrase: string = ''): Uint8Array {
    if (!validateMnemonicSeed(mnemonic)) {
        throw new Error('Invalid mnemonic seed phrase');
    }

    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    return seed;
}

/**
 * Save mnemonic seed to a file (browser download)
 * @param mnemonic - the mnemonic phrase
 * @param encryption - Encryption instance (required if encrypted is true)
 */
export async function saveMnemonicToFile(mnemonic: string, encryption?: Encryption)
    : Promise<void> {
    const { filename, mimeType } = encryption ?
        { filename: 'cashu-mnemonic-seed.enc', mimeType: 'application/octet-stream' }
        : { filename: 'cashu-mnemonic-seed.json', mimeType: 'application/json' };

    const content = await createMnemonicSeedData(mnemonic, encryption);
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
 * @param encryption - Encryption instance (required if the mnemonic should be encrypted)
 * @returns - promise with the mnemonic data in success case
 */
export async function createMnemonicSeedData(mnemonic: string, encryption?: Encryption)
    : Promise<MnemonicSeedData> {
    let content;

    if (encryption) {
        const encrypted = await encryption.encrypt(mnemonic);
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
 * Read mnemonic seed from a file (browser file upload)
 * @param file - The File object to read from
 * @param encryption - Decryption instance (required if file is encrypted)
 * @returns The mnemonic seed phrase
 */
export async function readMnemonicFromFile(file: File, encryption?: Encryption): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content) as MnemonicSeedData;
                if (isValidSeedData(data)) {
                    let mnemonic = await mnemonicFromSeedData(data, encryption);
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
 * @param encryption - the encryption instance to be use in case the mnemonic is encrypted
 * @returns - a promise to the mnemonic
 */
export async function mnemonicFromSeedData(data: MnemonicSeedData, encryption?: Encryption): Promise<string> {
    let mnemonic: string;

    if (data.encrypted) {
        if (!encryption) {
            throw new Error('Encryption instance required for encrypted file');
        }

        mnemonic = await encryption.decrypt(data.data);
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

interface Encryption {
    encrypt(data: string): Promise<string>;
    decrypt(data: string): Promise<string>;
}

export function nip44EncryptionForUser(user: NDKUser): Encryption {
    return {
        encrypt: (data: string) => {
            const encrypted = user.ndk?.signer?.encrypt(user, data);
            if (!encrypted) {
                throw new Error("Not ndk or signer set and needed for this function");
            }
            return encrypted;
        },
        decrypt: (data: string) => {
            const decrypted = user.ndk?.signer?.decrypt(user, data);
            if (!decrypted) {
                throw new Error("Not ndk or signer set and needed for this function");
            }
            return decrypted;
        }
    };
}

/**
 * Simple encryption using Web Crypto API
 * @param mnemonic - The mnemonic to encrypt
 * @param passphrase - The passphrase for encryption
 * @returns Base64 encoded encrypted data
 */
async function webEncryptMnemonic(mnemonic: string, passphrase: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);

    // Derive a key from the passphrase
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
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

/**
 * Simple decryption using Web Crypto API
 * @param encryptedData - Base64 encoded encrypted data
 * @param passphrase - The passphrase for decryption
 * @returns The decrypted mnemonic
 */
async function webDecryptMnemonic(encryptedData: string, passphrase: string): Promise<string> {
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
        encoder.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}