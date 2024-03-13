<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { page } from "$app/stores";

    import { messageStore, receivedMessageFilter, myMessageFilter } from "$lib/stores/messages";

    import { onDestroy, onMount } from "svelte";

	import { Avatar } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { NDKEvent, NDKKind, type NDKUser, type NDKUserProfile } from "@nostr-dev-kit/ndk";

    import { idFromNaddr } from '$lib/utils/nip19'

    const toastStore = getToastStore();

    const ticketAddress = idFromNaddr($page.params.ticketId);
    const ticketTitle = $page.params.title;

	interface MessageFeed {
		id: string;
		host: boolean;
		avatar: string;
		name: string;
        pubkey: string,
        recipient: string;
		timestamp: string;
		message: string;
		color: string;
	}

	let elemChat: HTMLElement;

    let searchInput = '';

    let needSetup = true;

	// Navigation List
	let people: NDKUser[] = [];
    let currentPerson: NDKUser;

	// All Messages
	let messages: MessageFeed[] = [];

    // Filtered messages by person but NOT YET by searchText
    let unfilteredMessageFeed: MessageFeed[] = [];

    // Filtered messages by person AND searchText 
	let filteredMessageFeed: MessageFeed[] = [];

	let currentMessage = '';

    let seenMessages: string[] = [];

	// For some reason, eslint thinks ScrollBehavior is undefined...
	// eslint-disable-next-line no-undef
	function scrollChatBottom(behavior?: ScrollBehavior): void {
		elemChat.scrollTo({ top: elemChat.scrollHeight, behavior });
	}

	async function sendMessage() {
        if (currentMessage) {
            if (!currentPerson) {
                const t: ToastSettings = {
                    message: 'No Person to message!',
                    timeout: 5000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
                return;
            }
            const dm = new NDKEvent($ndk);
            dm.kind = NDKKind.EncryptedDirectMessage;
            dm.content = currentMessage;
            dm.tags.push(['t', ticketAddress]);
            dm.tags.push(['p', currentPerson.pubkey]);

            await dm.encrypt();

            await dm.publish();

            // Clear prompt
            currentMessage = '';
        }
	}

	function onPromptKeydown(event: KeyboardEvent): void {
		if (['Enter'].includes(event.code)) {
			event.preventDefault();
			sendMessage();
		}
	}

    function updateUserProfile(user: NDKUser) {
        user.fetchProfile().then(() => {
            people = people;
            filteredMessageFeed.forEach((message: MessageFeed) => {
                if (message.pubkey === (user as NDKUser).pubkey) {
                    message.avatar = (user as NDKUser).profile?.image ?? '';
                    message.name = (user as NDKUser).profile?.name 
                        ?? (user as NDKUser).npub.substring(0,10);
                }
            });
            filteredMessageFeed = filteredMessageFeed;
        });
    }

    function generateCurrentFeed() {
        const unOrderedMessageFeed = messages.filter((message: MessageFeed) => {
            if (message.pubkey === currentPerson.pubkey) {
                return true;
            } else if(message.recipient === currentPerson.pubkey) {
                return true;
            }

            return false;
        });

        // Need to reorder feed according to 
        unfilteredMessageFeed = [];
        $messageStore.forEach((dm: NDKEvent) => {
            unOrderedMessageFeed.forEach((message: MessageFeed) => {
                if (message.id === dm.id) {
                    unfilteredMessageFeed.unshift(message);
                }
            });
        });

        // filter by the search bar
        searchText();

        // Smooth scroll to bottom
        // Timeout prevents race condition
        if (elemChat) {
            setTimeout(() => {
                scrollChatBottom('smooth');
            }, 0);
        }
    }

    function searchText() {
        filteredMessageFeed = unfilteredMessageFeed.filter((message: MessageFeed) => {
            if (message.message.includes(searchInput)) {
                return true;
            }
        });
    }

    async function updateMessageFeed() {
        for (const dm of $messageStore) {
            const alreadyHere: boolean = seenMessages.filter((id: string) => {
                if (dm.id === id) return true;
                return false;
            }).length > 0;

            if (alreadyHere) {
                continue;
            } else {
                seenMessages.push(dm.id);
            }

            let personOfMessage: NDKUser | undefined = undefined;
            let otherUser: NDKUser;

            let host = false;

            if (dm.pubkey === $ndk.activeUser?.pubkey) {
                host = true;
                personOfMessage = $ndk.activeUser;
                otherUser = $ndk.getUser({hexpubkey: dm.tagValue('p')});
            } else {
                otherUser = $ndk.getUser({hexpubkey: dm.pubkey});
                let personKnown = false;
                for (const person of people) {
                    if (person.pubkey === dm.pubkey) {
                        personKnown = true;
                        personOfMessage = person;
                    }
                }

                if (!personKnown) {
                    personOfMessage = $ndk.getUser({hexpubkey: dm.pubkey});
                    if (!currentPerson) {
                        currentPerson = personOfMessage; 
                    }
                    people.push(personOfMessage);

                    updateUserProfile(personOfMessage);
                }
            }

            try {
                // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
                // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
                // 
                // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

                await dm.decrypt(otherUser); // ALWAYS USE CURRENT PERSON REGARDLESS OF WHO SENT THE MESSAGE
                let message = dm.content;

                const messageDate = new Date(dm.created_at as number * 1000);
                // Time is shown in local time zone
                const dateString = messageDate.toLocaleString();


                const newMessage = {
                    id: dm.id,
                    host: host,
                    avatar: (personOfMessage as NDKUser).profile?.image ?? '',
                    name: (personOfMessage as NDKUser).profile?.name ?? (personOfMessage as NDKUser).npub.substring(0, 10),
                    pubkey: (personOfMessage as NDKUser).pubkey,
                    recipient: dm.tagValue('p') as string,
                    timestamp: dateString,
                    message: message,
                    color: 'variant-soft-primary'
                };

                messages.push(newMessage);

            } catch (e) {
                console.log(e);
            }
        }

        // Update the message feed
        generateCurrentFeed();
    }

	// When DOM mounted, scroll to bottom
	onMount(() => {
		scrollChatBottom();
	}); 

    onDestroy(()=>{
        myMessageFilter['authors'] = [];
        myMessageFilter['#t'] = [];

        receivedMessageFilter['#p'] = [];
        receivedMessageFilter['#t'] = [];

        messageStore.empty();
    });

    // If there is a logged in user, start receiving messages related to the ticket
    $: if ($ndk.activeUser && needSetup) {
        needSetup = false;
        myMessageFilter['authors'] = [];
        myMessageFilter['authors'].push($ndk.activeUser.pubkey);
        myMessageFilter['#t'] = [];
        myMessageFilter['#t'].push(ticketAddress);

        receivedMessageFilter['#p'] = [];
        receivedMessageFilter['#p'].push($ndk.activeUser.pubkey);
        receivedMessageFilter['#t'] = [];
        receivedMessageFilter['#t'].push(ticketAddress);

        messageStore.empty();
        messageStore.startSubscription();

        // If my ticket then just wait for messages to arrive
        // else I add the ticket creator to people
        let ticketPubkey = ticketAddress.split(':')[1];
        if ($ndk.activeUser.pubkey !== ticketPubkey) {
            currentPerson = $ndk.getUser({hexpubkey: ticketPubkey});
            people.push(currentPerson);
            
            updateUserProfile(currentPerson);

        }
    }

    $: if ($messageStore.length > 0) {
        updateMessageFeed();
    }

</script>

<div class="bg-surface-100-800-token p-2">
    <h2 class="h2 my-2 text-center font-bold">{'Ticket: ' + ticketTitle}</h2>
    <!-- Horizontal Navigation bar -->
    <div class="flex flex-col md:hidden border-r border-surface-500/30">
        <!-- Header -->
        <header class="border-b border-surface-500/30 p-2">
            <input
                class="input"
                type="search"
                placeholder="Search..."
                bind:value={searchInput}
                on:keyup={searchText}
            />
        </header>
        <!-- List -->
        <div class="grid grid-cols-5 p-2 pb-0 space-x-2">
            <small class="opacity-50">Contacts</small>
            <div class="flex flex-col space-y-1 col-start-2 col-span-4 max-h-24 overflow-y-auto">
                {#each people as person}
                    <button
                        type="button"
                        class="btn w-full flex items-center space-x-4 {person.pubkey === currentPerson.pubkey
                        ? 'variant-filled-primary'
                        : 'bg-surface-hover-token'}"
                        on:click={() => {
                            currentPerson = person;
                            generateCurrentFeed();
                            updateUserProfile(currentPerson);
                        }}
                    >
                        <Avatar
                            src={person.profile?.image}
                            width="w-8"
                        />
                        <span class="flex-1 text-start">
                            {person.profile?.name ?? person.npub.substring(0,15)}
                        </span>
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>
<section class="card">
    <div class="chat w-full h-full grid grid-cols-1 md:grid-cols-[30%_1fr]">
        <!-- Vertical Navigation bar -->
        <div class="hidden md:grid grid-rows-[auto_1fr_auto] border-r border-surface-500/30">
            <!-- Header -->
            <header class="border-b border-surface-500/30 p-4">
                <input
                    class="input"
                    type="search"
                    placeholder="Search..."
                    bind:value={searchInput}
                    on:keyup={searchText}
                />
            </header>
            <!-- List -->
            <div class="p-4 space-y-4 overflow-y-auto">
                <small class="opacity-50">Contacts</small>
                <div class="flex flex-col space-y-1">
                    {#each people as person}
                        <button
                            type="button"
                            class="btn w-full flex items-center space-x-4 {person.pubkey === currentPerson.pubkey
                            ? 'variant-filled-primary'
                            : 'bg-surface-hover-token'}"
                            on:click={() => {
                                currentPerson = person;
                                generateCurrentFeed();
                                updateUserProfile(currentPerson);
                            }}
                        >
                            <Avatar
                                src={person.profile?.image}
                                width="w-8"
                            />
                            <span class="flex-1 text-start">
                                {person.profile?.name ?? person.npub.substring(0,15)}
                            </span>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
        <!-- Chat -->
        <div class="grid grid-row-[1fr_auto]">
            <!-- Conversation -->
            <section bind:this={elemChat} class="max-h-[700px] p-4 overflow-y-auto space-y-4">
                {#each filteredMessageFeed as bubble}
                    {#if bubble.host === true}
                        <div class="grid grid-cols-[auto_1fr] gap-2">
                            <Avatar src={bubble.avatar} width="w-12" />
                            <div class="card p-4 variant-soft rounded-tl-none space-y-2">
                                <header class="flex justify-between items-center">
                                    <p class="font-bold">{bubble.name}</p>
                                    <small class="opacity-50">{bubble.timestamp}</small>
                                </header>
                                <p>{bubble.message}</p>
                            </div>
                        </div>
                    {:else}
                        <div class="grid grid-cols-[1fr_auto] gap-2">
                            <div class="card p-4 rounded-tr-none space-y-2 {bubble.color}">
                                <header class="flex justify-between items-center">
                                    <p class="font-bold">{bubble.name}</p>
                                    <small class="opacity-50">{bubble.timestamp}</small>
                                </header>
                                <p>{bubble.message}</p>
                            </div>
                            <Avatar src={bubble.avatar} width="w-12" />
                        </div>
                    {/if}
                {/each}
            </section>
        </div>
    </div>
</section>
<!-- Prompt -->
<section class="sticky bottom-0 w-full border-t border-surface-500/30 bg-surface-100-800-token p-4">
    <div class="input-group input-group-divider grid-cols-[auto_1fr_auto] rounded-container-token">
        <button class="input-group-shim">+</button>
        <textarea
            bind:value={currentMessage}
            class="bg-transparent border-0 ring-0"
            name="prompt"
            id="prompt"
            placeholder="Write a message..."
            rows="1"
            on:keydown={onPromptKeydown}
        />
        <button class={currentMessage ? 'variant-filled-primary' : 'input-group-shim'} on:click={sendMessage}>
            <i class="fa-solid fa-paper-plane" />
        </button>
    </div>
</section>
