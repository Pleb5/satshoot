import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Generate a new mnemonic seed phrase (BIP39)

import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

// Constants from NUT-13 specification
const DERIVATION_PATH = `m/129372'/0'`; // Standard derivation path for Cashu
}

/**
 * Save mnemonic seed to a file (browser download)
 * @param mnemonic - the mnemonic phrase
    lastBackupAt?: number;
}

/**
 * Generate a new mnemonic seed phrase (BIP39)
 * @param strength - Strength in bits (128, 160, 192, 224, or 256). Default is 128 (12 words)
 * @returns - promise with the mnemonic data in success case
 */
export function generateMnemonicSeed(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
    const mnemonic = generateMnemonic(wordlist, strength);
    
    return mnemonic;
}

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
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
        {
 * @param encrypted - Whether to encrypt the mnemonic before saving
 * @param passphrase - Encryption passphrase (required if encrypted is true)
 */
export async function saveMnemonicToFile(mnemonic: string, encrypted: boolean = false, passphrase?: string): Promise<void> {
    let content: string;
    let filename: string;
    let mimeType: string;

    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
        
        // Simple XOR encryption for the browser environment
        // In production, use a proper encryption library like CryptoJS or WebCrypto API
        const encrypted = await encryptMnemonic(mnemonic, passphrase);
        content = JSON.stringify({
            encrypted: true,
            data: encrypted,
            createdAt: Date.now(),
            version: '1.0'
        });
        filename = 'cashu-mnemonic-seed.enc';

    } else {
        content = JSON.stringify({
            encrypted: false,
            mnemonic: mnemonic,
            createdAt: Date.now(),
            version: '1.0'
        });
        filename = 'cashu-mnemonic-seed.json';
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
        true,
        ['encrypt', 'decrypt']
    );
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
                    throw new Error('Invalid mnemonic seed in file');
                }
                
                resolve(mnemonic);
            } catch (error) {
                reject(new Error(`Failed to read mnemonic from file: ${error}`));
    );
    
    return decoder.decode(decrypted);
}