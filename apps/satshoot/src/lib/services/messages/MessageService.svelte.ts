import {
    NDKEvent,
    NDKKind,
    NDKSubscription,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    type NDKSigner,
    type NDKUser,
    giftWrap,
    giftUnwrap,
} from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
import { wot as wotStore } from '$lib/stores/wot';
import currentUserStore from '$lib/stores/user';
import currentUser from '$lib/stores/user';

/**
 * Service for handling message-related functionality
 */
export class MessageService {
    // Public state for direct access
    messages = $state<NDKEvent[]>([]);

    // Private properties
    private eventAddress: string;
    private subscription: NDKSubscription | null = null;

    constructor(eventAddress: string) {
        this.eventAddress = eventAddress;
    }

    /**
     * Initialize subscription to messages for this event
     */
    initialize(currentUserPubkey: string) {
        const ndkInstance = get(ndk);

        const messagesFilter: NDKFilter[] = [
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                '#a': [this.eventAddress],
                '#p': [currentUserPubkey],
                limit: 50,
            },
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                '#a': [this.eventAddress],
                authors: [currentUserPubkey],
                limit: 50,
            },
        ];

        const messageSubOptions: NDKSubscribeOptions = {
            autoStart: true,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: false,
            groupable: false,
        };

        this.subscription = ndkInstance.subscribe(messagesFilter, messageSubOptions);
        // Use arrow function to preserve 'this' context
        this.subscription.on('event', (event) => this.handleMessageEvent(event));
    }

    handleMessageEvent(message: NDKEvent) {
        // after sending message we add it to message event to messages array.
        // so, before adding recevived message check whether it's already added.
        if (this.messages.some((m) => m.id === message.id)) return;

        const wot = get(wotStore);
        const peer = this.peerFromMessage(message);

        if (peer && wot.has(peer)) {
            this.messages = [...this.messages, message];
        }
    }

    peerFromMessage(message: NDKEvent): string | undefined {
        const currentUser = get(currentUserStore);
        const peerPubkey =
            message.tagValue('p') === currentUser!.pubkey ? message.pubkey : message.tagValue('p');

        return peerPubkey;
    }

    /**
     * Get messages from/to a specific person
     */
    getPersonMessages(person: NDKUser, messages: NDKEvent[]) {
        return messages.filter((message) => {
            // Check if message is from or to the person
            const isPeer = this.isPeerInMessage(person, message);
            return isPeer;
        });
    }

    /**
     * Check if a person is a peer in a message
     */
    private isPeerInMessage(person: NDKUser, message: NDKEvent): boolean {
        // Message is either from the person or to the person
        return (
            message.pubkey === person.pubkey ||
            message.tags.some((tag) => tag[0] === 'p' && tag[1] === person.pubkey)
        );
    }

    /**
     * Order messages chronologically
     */
    orderMessages(messages: NDKEvent[]) {
        return [...messages].sort((a, b) => {
            const aTime = a.created_at || 0;
            const bTime = b.created_at || 0;
            return aTime - bTime;
        });
    }

    /**
     * Send a message to a person
     */
    async sendMessage(recipient: NDKUser, content: string) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        // const message: NDKEvent = new NDKEvent(ndkInstance);
        // message.kind = NDKKind.PrivateDirectMessage;
        // message.tags.push(['p', recipient.pubkey]);
        // message.tags.push(['a', this.eventAddress]);
        // message.content = content;

        // try {
        //     // NOT deniable
        //     await message.sign();
        //     console.log('Rumor', message);
        //     const encryptedDMforReceiver = await giftWrap(message, recipient, ndkInstance.signer, {
        //         stripSig: false,
        //     });
        //     const encryptedDMforSender = await giftWrap(
        //         message,
        //         get(currentUser),
        //         ndkInstance.signer,
        //         { stripSig: false }
        //     );
        //     // const decrypted = await giftUnwrap(encrypted, sendUser, receiveSigner);

        //     // TODO: how does the sender open his own messages currently? it is supposed to be encrypted
        //     // to the pubkey of the receiver... ?
        //     // The modify subs to fetch giftwraps of current user and clients/freelancers?

        //     // immediately add the dm to messages array
        //     this.messages = [...this.messages, encryptedDMforReceiver];
        //     // publish the dm asynchronously
        //     console.log('message to publish', encryptedDMforReceiver);
        //     encryptedDMforReceiver.publish();
        // } catch (error) {
        //     console.error('Failed to send message:', error);
        //     throw error;
        // }

        // moving back to encrypted dm for now, it will be replaced with private DM later
        const dm = new NDKEvent(ndkInstance);
        dm.kind = NDKKind.EncryptedDirectMessage;
        dm.content = content;
        dm.tags.push(['a', this.eventAddress]);
        dm.tags.push(['p', recipient.pubkey]);
        dm.content = await (ndkInstance.signer as NDKSigner).encrypt(recipient, content);

        try {
            // sign the dm
            await dm.sign();

            // immediately add the dm to messages array
            this.messages = [...this.messages, dm];
            // publish the dm asynchronously
            dm.publish();
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Check if a message is the first of the day (for date separators)
     */
    isFirstMessageOfDay(messages: NDKEvent[], index: number): boolean {
        if (index === 0) return true;

        const currentMessage = messages[index];
        const previousMessage = messages[index - 1];

        if (!currentMessage?.created_at || !previousMessage?.created_at) {
            return false;
        }

        const currentDate = new Date(currentMessage.created_at * 1000);
        const previousDate = new Date(previousMessage.created_at * 1000);

        return currentDate.toDateString() !== previousDate.toDateString();
    }

    /**
     * Unsubscribe from messages
     */
    unsubscribe() {
        if (this.subscription) {
            this.subscription.stop();
            this.subscription = null;
        }
    }
}
