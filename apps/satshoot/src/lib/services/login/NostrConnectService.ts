import NDK, { NDKKind, NDKNip46Signer, NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { DEFAULTRELAYURLS } from '$lib/stores/session';
import { bytesToHex } from '@noble/hashes/utils';

export interface NostrConnectConfig {
    appName: string;
    appUrl: string;
    relays: readonly string[];
    permissions?: readonly string[];
    appImage?: string;
}

/**
 * NostrConnectService handles NIP-46 remote signing functionality.
 *
 * This service manages the complete lifecycle of a NostrConnect connection:
 * 1. Generates local ephemeral keypairs for secure communication
 * 2. Creates nostrconnect:// URIs for QR code scanning
 * 3. Listens for remote signer responses and establishes connections
 * 4. Provides authenticated signers for making Nostr requests
 *
 * NOTE: Current NDK version does not implement nostrconnect flow.
 * Therefore, this service accesses internal NDK properties (like .rpc)
 * This is necessary because:
 *
 * 1. NDKNip46Signer.rpc - We need direct access to the RPC layer to:
 *    - Subscribe to NIP-46 response events manually
 *    - Parse incoming connection responses
 *    - Handle the connection handshake flow
 *
 * 2. NDKNip46Signer.bunkerPubkey/userPubkey - These are set directly because
 *    the signer needs to know the remote pubkey before it can function properly
 */
// NOTE: The latest version of the NDK handles the connection handshake flow automatically.
// When we'll upgrade to the latest version of the NDK, a lot of this code will be obsolete.
export class NostrConnectService {
    private ndk: InstanceType<typeof NDK>;
    private secret: string;

    public localKeyPair: {
        privateKey: string;
        publicKey: string;
    };

    public signer: InstanceType<typeof NDKNip46Signer>;

    constructor(relays: readonly string[] = DEFAULTRELAYURLS) {
        this.ndk = new NDK({
            explicitRelayUrls: [...relays],
        });

        const sk = generateSecretKey();
        this.localKeyPair = {
            privateKey: bytesToHex(sk),
            publicKey: getPublicKey(sk),
        };

        this.secret = this.generateSecret();

        // Create NIP-46 signer with local private key signer
        // Remote pubkey is empty initially - will be set after successful connection
        this.signer = new NDKNip46Signer(
            this.ndk,
            '',
            new NDKPrivateKeySigner(this.localKeyPair.privateKey)
        );
    }

    /**
     * Generate a random secret for connection authentication.
     * This secret is included in the nostrconnect:// URI and must be returned
     * by the remote signer to prove they scanned our QR code.
     * @returns 8-character random alphanumeric string
     */
    private generateSecret(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Create a Nostr Connect URI for QR code display.
     * This URI follows the NIP-46 specification and contains all information
     * needed for a remote signer (like a mobile app) to establish a connection.
     *
     * @param config - Configuration containing app metadata and connection details
     * @returns nostrconnect:// URI that can be displayed as a QR code
     */
    createNostrConnectUri(config: NostrConnectConfig): string {
        const params = new URLSearchParams();

        // Add secret for authentication - remote signer must return this to prove connection
        params.append('secret', this.secret);

        // Add relay URLs where NIP-46 messages will be exchanged
        config.relays.forEach((relay) => {
            params.append('relay', relay);
        });

        // Add requested permissions (optional) - what the app wants to be able to do
        if (config.permissions && config.permissions.length > 0) {
            params.append('perms', [...config.permissions].join(','));
        }

        // Add app metadata for display in remote signer
        params.append('name', config.appName);
        params.append('url', config.appUrl);

        if (config.appImage) {
            params.append('image', config.appImage);
        }

        // Format: nostrconnect://<local-pubkey>?<params>
        // The local pubkey is used by remote signer to encrypt responses back to us
        const uri = `nostrconnect://${this.localKeyPair.publicKey}?${params.toString()}`;
        return uri;
    }

    /**
     * Wait for remote signer to connect and establish the NIP-46 session.
     *
     * This method:
     * 1. Connects to relays to listen for responses
     * 2. Subscribes to NIP-46 events directed at our local pubkey
     * 3. Waits for a response containing our secret (proving the QR was scanned)
     * 4. Sets up the signer with the remote pubkey for future signing requests
     *
     * NOTE: We access internal properties here because:
     * - signer.rpc: We need to manually subscribe and parse NIP-46 events
     * - signer.userPubkey/bunkerPubkey: Must be set manually after connection
     * - The NDK NIP-46 signer doesn't handle the NostrConnect handshake flow automatically yet.
     *
     * @returns Promise that resolves with the configured NIP-46 signer
     */
    async waitForConnection() {
        // Ensure NDK is connected to relays before listening for responses
        await this.ndk.connect();

        const rpc = this.signer.rpc;

        const sub = await rpc.subscribe({
            kinds: [NDKKind.NostrConnect],
            '#p': [this.localKeyPair.publicKey],
        });

        return new Promise<InstanceType<typeof NDKNip46Signer>>((resolve, reject) => {
            const connect = (response: any) => {
                // Verify the response contains our secret (proves QR scan)
                if (response.result === this.secret) {
                    // Set remote pubkey - required for the signer to function
                    // Both userPubkey and bunkerPubkey point to the remote signer
                    this.signer.userPubkey = response.event.pubkey;
                    this.signer.bunkerPubkey = response.event.pubkey;

                    // Clean up event listener and resolve
                    this.signer.rpc.off('response', connect);
                    resolve(this.signer);
                }
            };

            // Parse incoming NIP-46 events and emit as responses
            sub.on('event', async (event: any) => {
                const parsedEvent = await this.signer.rpc.parseEvent(event);
                rpc.emit('response', parsedEvent);
            });

            // Listen for parsed responses
            rpc.on('response', connect);
        });
    }

    /**
     * Restore an existing NostrConnect connection from stored credentials.
     * This allows resuming a previously established NIP-46 session without
     * requiring the user to scan a QR code again.
     *
     * NOTE: We access internal properties (bunkerPubkey/userPubkey) because
     * the NDK constructor doesn't accept these values - they must be set manually
     * after instantiation to recreate the connection state.
     *
     * @param privateKey - The local private key used in the original connection
     * @param remotePubkey - The remote signer's public key from the original connection
     * @param relays - Array of relay URLs to connect to
     * @returns Configured NIP-46 signer or null if restoration fails
     */
    static async restore(
        privateKey: string,
        remotePubkey: string,
        relays: readonly string[] = DEFAULTRELAYURLS
    ): Promise<InstanceType<typeof NDKNip46Signer> | null> {
        try {
            // Create fresh NDK instance for the restored connection
            const restoreNdk = new NDK({
                explicitRelayUrls: [...relays],
            });

            await restoreNdk.connect();

            const localSigner = new NDKPrivateKeySigner(privateKey);

            const nip46Signer = new NDKNip46Signer(restoreNdk, '', localSigner);

            // Manually set the remote pubkey to restore connection state
            // These internal properties must be set for the signer to work
            nip46Signer.bunkerPubkey = remotePubkey;
            nip46Signer.userPubkey = remotePubkey;

            await nip46Signer.blockUntilReady()

            return nip46Signer;
        } catch (error) {
            console.error('NostrConnect restoration failed:', error);
            return null;
        }
    }

    /**
     * Disconnect and cleanup resources.
     * Closes any active subscriptions to prevent memory leaks.
     */
    disconnect(): void {
        if (this.signer) {
            // Clean up active subscription if it exists
            // This prevents memory leaks and stops listening for events
            if (this.signer.subscription) {
                this.signer.subscription.close();
            }
        }
    }
}
