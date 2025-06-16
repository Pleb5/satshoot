import {
    NDKEvent,
    NDKKind,
    NDKSubscription,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    type NDKSigner,
    type NDKUser,
} from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';
import { get } from 'svelte/store';
import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
import currentUserStore from '$lib/stores/user';
import SELECTED_QUERY_PARAM from '.';

export class MessageService {
    messages = $state<NDKEvent[]>([]);

    private encodedAddress?: string;
    private eventAddress: string;
    private subscription: NDKSubscription | null = null;

    constructor(eventAddress: string, encodedAddress?: string) {
        this.eventAddress = eventAddress;
        if (encodedAddress) this.encodedAddress = encodedAddress;
    }


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
        this.subscription.on('event', async (event) => {
            // This is a temporary NDK fix: Somehow the cache
            // returns one additional invalid event that is
            // the copy of one of the messages subscribed to
            //  but its ID is EMPTY string and the signature 
            //  has the real ID of the message event.
            //  Also, the corrupted event is NOT verified yet.
            if (event.id === "") return;

            this.handleMessageEvent(event)
        });
    }

    handleMessageEvent(message: NDKEvent) {
        if (this.messages.some((m) => m.id === message.id)){console.log('message already there, returning...', message); return}

        this.messages = [...this.messages, message];
    }

    peerFromMessage(message: NDKEvent): string | undefined {
        const currentUser = get(currentUserStore);
        const peerPubkey =
            message.tagValue('p') === currentUser!.pubkey ? message.pubkey : message.tagValue('p');

        return peerPubkey;
    }

    getPersonMessages(person: NDKUser, messages: NDKEvent[]) {
        return messages.filter((message) => {
            // Check if message is from or to the person
            const isPeer = this.isPeerInMessage(person, message);
            return isPeer;
        });
    }

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

    async sendMessage(recipient: NDKUser, content: string) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        const currentUser = get(currentUserStore);

        if (this.encodedAddress && currentUser) {
            const url = new URL('/messages/' + this.encodedAddress, window.location.origin);
            url.searchParams.append(SELECTED_QUERY_PARAM, currentUser.pubkey);

            content += `\nReply to this message in SatShoot: ${url.toString()}`;
        }

        const dm = new NDKEvent(ndkInstance);
        dm.kind = NDKKind.EncryptedDirectMessage;
        dm.tags.push(['a', this.eventAddress]);
        dm.tags.push(['p', recipient.pubkey]);
        dm.content = await (ndkInstance.signer as NDKSigner).encrypt(recipient, content);

        try {
            await dm.sign();

            this.messages = [...this.messages, dm];
            dm.publish();
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    }

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

    unsubscribe() {
        if (this.subscription) {
            this.subscription.stop();
            this.subscription = null;
        }
    }
}
