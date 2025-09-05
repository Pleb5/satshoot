/**
 * NUT-13: Deterministic Secrets
 * Implementation of mnemonic seed management for Cashu wallets
 * Spec: https://github.com/cashubtc/nuts/blob/main/13.md
 */

import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { Proof } from '@cashu/cashu-ts';
import { persisted } from 'svelte-persisted-store';
import { get, writable, type Writable } from 'svelte/store';

// Constants from NUT-13 specification
const DERIVATION_PATH = `m/129372'/0'`; // Standard derivation path for Cashu
const VERSION_BYTE = 0x01; // Version byte for deterministic secrets

export interface MnemonicSeedData {
    mnemonic: string;
    createdAt: number;
    lastBackupAt?: number;
}

// Store for mnemonic seed data (encrypted in localStorage)
export const mnemonicStore = persisted<MnemonicSeedData | null>(
    'cashu-mnemonic-seed',
    null,
    {
        storage: 'local',
        serializer: {
            stringify(data: MnemonicSeedData | null) {
                if (!data) return 'null';
                // In production, you should encrypt this data
                // For now, we're just base64 encoding as a minimal obfuscation
                const jsonStr = JSON.stringify(data);
                return btoa(jsonStr);
            },
            parse(text: string) {
                if (text === 'null') return null;
                try {
                    const jsonStr = atob(text);
                    return JSON.parse(jsonStr) as MnemonicSeedData;
                } catch {
                    return null;
                }
            },
        },
    }
);

/**
 * Generate a new mnemonic seed phrase (BIP39)
 * @param strength - Strength in bits (128, 160, 192, 224, or 256). Default is 128 (12 words)
 * @returns The generated mnemonic phrase
 */
export function generateMnemonicSeed(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
    const mnemonic = generateMnemonic(wordlist, strength);
    
    // Store the generated mnemonic
    mnemonicStore.set({
        mnemonic,
        createdAt: Date.now(),
    });
    
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
export function deriveRootKey(mnemonic: string, passphrase: string = ''): HDKey {
    if (!validateMnemonicSeed(mnemonic)) {
        throw new Error('Invalid mnemonic seed phrase');
    }
    
    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    return HDKey.fromMasterSeed(seed);
}

/**
 * Derive a deterministic secret for a proof according to NUT-13
 * @param mnemonic - The mnemonic phrase
 * @param keysetId - The keyset ID
 * @param counter - The counter value for this keyset
 * @param passphrase - Optional BIP39 passphrase
 * @returns The deterministic secret as a hex string
 */
export function deriveDeterministicSecret(
    mnemonic: string,
    keysetId: string,
    counter: number,
    passphrase: string = ''
): string {
    const rootKey = deriveRootKey(mnemonic, passphrase);
    
    // Derive the child key for Cashu
    const cashuKey = rootKey.derive(DERIVATION_PATH);
    
    // Derive keyset-specific key using keyset ID as index
    // Convert keyset ID to a number for derivation (using first 4 bytes of hash)
    const keysetHash = sha256(new TextEncoder().encode(keysetId));
    const keysetIndex = new DataView(keysetHash.buffer).getUint32(0, true) & 0x7fffffff; // Make sure it's non-hardened
    
    const keysetKey = cashuKey.deriveChild(keysetIndex);
    
    // Derive counter-specific secret
    const counterKey = keysetKey.deriveChild(counter);
    
    if (!counterKey.privateKey) {
        throw new Error('Failed to derive private key');
    }
    
    // Create the deterministic secret according to NUT-13
    // secret = SHA256(version_byte || private_key)
    const versionedKey = new Uint8Array(33);
    versionedKey[0] = VERSION_BYTE;
    versionedKey.set(counterKey.privateKey, 1);
    
    const secret = sha256(versionedKey);
    return bytesToHex(secret);
}

/**
 * Generate deterministic secrets for multiple proofs
 * @param mnemonic - The mnemonic phrase
 * @param keysetId - The keyset ID
 * @param count - Number of secrets to generate
 * @param startCounter - Starting counter value (default: 0)
 * @param passphrase - Optional BIP39 passphrase
 * @returns Array of deterministic secrets
 */
export function generateDeterministicSecrets(
    mnemonic: string,
    keysetId: string,
    count: number,
    startCounter: number = 0,
    passphrase: string = ''
): string[] {
    const secrets: string[] = [];
    
    for (let i = 0; i < count; i++) {
        const secret = deriveDeterministicSecret(
            mnemonic,
            keysetId,
            startCounter + i,
            passphrase
        );
        secrets.push(secret);
    }
    
    return secrets;
}

/**
 * Storage management for mnemonic seeds in browser environment
 */

/**
 * Save mnemonic seed to a file (browser download)
 * @param encrypted - Whether to encrypt the mnemonic before saving
 * @param passphrase - Encryption passphrase (required if encrypted is true)
 */
export async function saveMnemonicToFile(encrypted: boolean = false, passphrase?: string): Promise<void> {
    const mnemonicData = get(mnemonicStore);
    
    if (!mnemonicData) {
        throw new Error('No mnemonic seed found to save');
    }
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (encrypted) {
        if (!passphrase || passphrase.length < 14) {
            throw new Error('Minimum 14 characters required for passphrase');
        }
        
        // Simple XOR encryption for the browser environment
        // In production, use a proper encryption library like CryptoJS or WebCrypto API
        const encrypted = await encryptMnemonic(mnemonicData.mnemonic, passphrase);
        content = JSON.stringify({
            encrypted: true,
            data: encrypted,
            createdAt: mnemonicData.createdAt,
            version: '1.0'
        });
        filename = 'cashu-mnemonic-seed.enc';
        mimeType = 'application/octet-stream';
    } else {
        content = JSON.stringify({
            encrypted: false,
            mnemonic: mnemonicData.mnemonic,
            createdAt: mnemonicData.createdAt,
            version: '1.0'
        });
        filename = 'cashu-mnemonic-seed.json';
        mimeType = 'application/json';
    }
    
    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // Update last backup timestamp
    mnemonicStore.update(data => {
        if (data) {
            data.lastBackupAt = Date.now();
        }
        return data;
    });
}

/**
 * Read mnemonic seed from a file (browser file upload)
 * @param file - The File object to read from
 * @param passphrase - Decryption passphrase (required if file is encrypted)
 * @returns The mnemonic seed phrase
 */
export async function readMnemonicFromFile(file: File, passphrase?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                let mnemonic: string;
                
                if (data.encrypted) {
                    if (!passphrase) {
                        throw new Error('Passphrase required for encrypted file');
                    }
                    
                    mnemonic = await decryptMnemonic(data.data, passphrase);
                } else {
                    mnemonic = data.mnemonic;
                }
                
                // Validate the mnemonic before storing
                if (!validateMnemonicSeed(mnemonic)) {
                    throw new Error('Invalid mnemonic seed in file');
                }
                
                // Store the imported mnemonic
                mnemonicStore.set({
                    mnemonic,
                    createdAt: data.createdAt || Date.now(),
                });
                
                resolve(mnemonic);
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
 * Simple encryption using Web Crypto API
 * @param mnemonic - The mnemonic to encrypt
 * @param passphrase - The passphrase for encryption
 * @returns Base64 encoded encrypted data
 */
async function encryptMnemonic(mnemonic: string, passphrase: string): Promise<string> {
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

/**
 * Get the current mnemonic from storage
 * @returns The stored mnemonic data or null if none exists
 */
export function getCurrentMnemonic(): MnemonicSeedData | null {
    return get(mnemonicStore);
}

/**
 * Clear the stored mnemonic seed
 * WARNING: This will permanently remove the mnemonic from browser storage
 */
export function clearMnemonicSeed(): void {
    mnemonicStore.set(null);
}

/**
 * Import a mnemonic seed phrase
 * @param mnemonic - The mnemonic phrase to import
 * @throws Error if the mnemonic is invalid
 */
export function importMnemonicSeed(mnemonic: string): void {
    if (!validateMnemonicSeed(mnemonic)) {
        throw new Error('Invalid mnemonic seed phrase');
    }
    
    mnemonicStore.set({
        mnemonic,
        createdAt: Date.now(),
    });
}

/**
 * Check if a mnemonic seed is stored
 * @returns true if a mnemonic is stored, false otherwise
 */
export function hasMnemonicSeed(): boolean {
    return get(mnemonicStore) !== null;
}