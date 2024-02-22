<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import pageTitleStore from "$lib/stores/pagetitle-store";
    import { page } from "$app/stores";

    import { messageStore, receivedMessageFilter, myMessageFilter } from "$lib/stores/messages";

    import { onDestroy, onMount } from "svelte";

	import { Avatar } from '@skeletonlabs/skeleton';
    import { NDKEvent, NDKKind, type NDKUser } from "@nostr-dev-kit/ndk";

    import { idFromNaddr } from '$lib/utils/nip19'

    const ticketAddress = idFromNaddr($page.params.ticketId);
    const ticketTitle = $page.params.title;

    $pageTitleStore = 'Messages';


	interface MessageFeed {
		id: number;
		host: boolean;
		avatar: string;
		name: string;
        pubkey: string,
		timestamp: string;
		message: string;
		color: string;
	}

	let elemChat: HTMLElement;

	// Navigation List
	let people: NDKUser[] = [];
    let currentPersonId: string;

	// All Messages
	let messages: MessageFeed[] = [];
    // Filtered messages by person 
	let messageFeed: MessageFeed[] = [];
	let currentMessage = '';

	// For some reason, eslint thinks ScrollBehavior is undefined...
	// eslint-disable-next-line no-undef
	function scrollChatBottom(behavior?: ScrollBehavior): void {
		elemChat.scrollTo({ top: elemChat.scrollHeight, behavior });
	}

	async function sendMessage() {
        const dm = new NDKEvent($ndk);
        dm.kind = NDKKind.EncryptedDirectMessage;
        dm.tags.push(['t', ticketAddress]);
        dm.tags.push(['p', currentPersonId]);

        console.log('event to encrypt: ', dm)

        dm.encrypt();

        await dm.publish();

        // Clear prompt
        currentMessage = '';
	}

	function onPromptKeydown(event: KeyboardEvent): void {
		if (['Enter'].includes(event.code)) {
			event.preventDefault();
			sendMessage();
		}
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

    $: if ($ndk.activeUser) {
        // If my ticket then just wait for messages to arrive
        // else I add the ticket creator to people
        let ticketPubkey = ticketAddress.split(':')[1];
        if ($ndk.activeUser.pubkey !== ticketPubkey) {
            people.push($ndk.getUser({hexpubkey: ticketPubkey}));
            currentPersonId = ticketPubkey;
            people = people;
        }
    }

    $: if ($messageStore) {
        $messageStore.forEach(async (dm: NDKEvent) => {
            messages = [];
            let personOfMessage: NDKUser | undefined = undefined;

            let host = false;

            if (dm.pubkey === $ndk.activeUser?.pubkey) {
                host = true;
                personOfMessage = $ndk.activeUser;
            } else {
                let personKnown = false;
                people.forEach((person: NDKUser) => {
                    if (person.pubkey === dm.pubkey) {
                        personKnown = true;
                        personOfMessage = person;
                    }
                });
                if (!personKnown) {
                    personOfMessage = $ndk.getUser({hexpubkey: dm.pubkey}); 
                    people.push(personOfMessage);
                    await personOfMessage.fetchProfile();
                }
            }
            
            await dm.decrypt($ndk.activeUser, $ndk.signer);
            let message = dm.content;

            const messageDate = new Date(dm.created_at as number * 1000);
            // Time is shown in local time zone
            const dateString = messageDate.toTimeString();


            const newMessage = {
                id: messages.length,
                host: host,
                avatar: (personOfMessage as NDKUser).profile?.image ?? '',
                name: (personOfMessage as NDKUser).profile?.name ?? (personOfMessage as NDKUser).npub.substring(0, 10),
                pubkey: (personOfMessage as NDKUser).pubkey,
                timestamp: dateString,
                message: message,
                color: 'variant-soft-primary'
            };

            messages.push(newMessage);
            messageFeed = messages.filter((message: MessageFeed) => {
                message.pubkey === currentPersonId;
            });

        });
        // Update the message feed
        messages = messages;

        // Smooth scroll to bottom
        // Timeout prevents race condition
        setTimeout(() => {
            scrollChatBottom('smooth');
        }, 0);
    }

    // If there is a logged in user, start receiving messages related to the ticket
    $: if ($ndk.activeUser) {
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
    }
    
</script>
<h2 class="h2 my-4 text-center font-bold">{'Ticket: ' + ticketTitle}</h2>
<section class="card mx-4">
    <div class="chat w-full h-full grid grid-cols-1 lg:grid-cols-[30%_1fr]">
        <!-- Navigation -->
        <div class="hidden lg:grid grid-rows-[auto_1fr_auto] border-r border-surface-500/30">
            <!-- Header -->
            <header class="border-b border-surface-500/30 p-4">
                <input class="input" type="search" placeholder="Search..." />
            </header>
            <!-- List -->
            <div class="p-4 space-y-4 overflow-y-auto">
                <small class="opacity-50">Contacts</small>
                <div class="flex flex-col space-y-1">
                    {#each people as person}
                        <button
                            type="button"
                            class="btn w-full flex items-center space-x-4 {person.pubkey === currentPersonId
                            ? 'variant-filled-primary'
                            : 'bg-surface-hover-token'}"
                            on:click={() => (currentPersonId = person.pubkey)}
                            >
                            <Avatar
                                src={person.profile?.image}
                                width="w-8"
                            />
                            <span class="flex-1 text-start">
                                {person.profile?.name}
                            </span>
                        </button>
                    {/each}
                </div>
            </div>
            <!-- Footer -->
            <!-- <footer class="border-t border-surface-500/30 p-4">(footer)</footer> -->
        </div>
        <!-- Chat -->
        <div class="grid grid-row-[1fr_auto]">
            <!-- Conversation -->
            <section bind:this={elemChat} class="max-h-[500px] p-4 overflow-y-auto space-y-4">
                {#each messages as bubble}
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
            <!-- Prompt -->
            <section class="border-t border-surface-500/30 p-4">
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
        </div>
    </div>
</section>
