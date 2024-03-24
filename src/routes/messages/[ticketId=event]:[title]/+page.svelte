<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { page } from "$app/stores";

    import { messageStore, receivedMessageFilter, myMessageFilter } from "$lib/stores/messages";
    import { offersOnTickets, offersOnTicketsFilter } from "$lib/stores/troubleshoot-eventstores";

    import { onDestroy, onMount } from "svelte";

	import { Avatar } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { NDKEvent, NDKKind, type NDKUser } from "@nostr-dev-kit/ndk";

    import { idFromNaddr } from '$lib/utils/nip19'
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import { afterNavigate } from "$app/navigation";


    const toastStore = getToastStore();

    const ticketAddress = idFromNaddr($page.params.ticketId);
    let titleLink = '/' + $page.params.ticketId;
    let ticketTitle:string = 'Ticket: ?';

    let ticket: TicketEvent | null = null;
    let myTicket = false;

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
    let elemHeader:HTMLElement;
    let elemPrompt:HTMLElement;
    let chatHeight: number;
    let hideChat = false;
    let contactsHeight = 'h-14';
    let arrowDown = true;
    let hideSearch = false;

    let currentMessage: string = '';


    let searchInput = '';

    let needSetup = true;

	// Contact List
	let people:NDKUser[] = [];
    let currentPerson: NDKUser;

    // The pubkey of the person who made the winning Offer
    let winner = '';

	// All Messages
	let messages: MessageFeed[] = [];

    // Filtered messages by person but NOT YET by searchText
    let unfilteredMessageFeed: MessageFeed[] = [];

    // Filtered messages by person AND searchText 
	let filteredMessageFeed: MessageFeed[] = [];

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

            console.log('dm', dm)

            // Clear prompt
            currentMessage = '';

            await dm.encrypt();

            await dm.publish();
        }
	}

	function onPromptKeyDown(event: KeyboardEvent) {
		if (['Enter'].includes(event.code)) {
			event.preventDefault();
			sendMessage();
		}
	}

    function updateUserProfile(user: NDKUser) {
        user.fetchProfile().then(() => {
            console.log('updateUserProfile', user)
            people = people;
            filteredMessageFeed.forEach((message: MessageFeed) => {
                if (message.pubkey === (user as NDKUser).pubkey) {
                    message.avatar = (user as NDKUser).profile?.image 
                        ?? `https://robohash.org/${message.pubkey}`;
                    message.name = (user as NDKUser).profile?.name 
                        ?? (user as NDKUser).npub.substring(0,10);
                }
            });
            filteredMessageFeed = filteredMessageFeed;
        });
    }

    function addPerson(pubkey: string): NDKUser {
        for (const person of people) {
            if (person.pubkey === pubkey) {
                return person;
            }
        }
        
        // We havent added this person yet
        const person = $ndk.getUser({hexpubkey: pubkey});
        console.log('adding new person', person)
        people.push(person);
        people = people;
        updateUserProfile(person);

        return person;
    }

    function selectCurrentPerson(person: NDKUser, i: number) {
        if (currentPerson !== person){
            console.log('selectCurrentPerson')
            // Swap current person to top
            currentPerson = person;
            people[i] = people[0];
            people[0] = currentPerson;

            generateCurrentFeed();
            updateUserProfile(currentPerson);
            resetContactsList();
        }
    }

    function generateCurrentFeed() {
        if (messages.length > 0) {
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
    }

    function searchText() {
        filteredMessageFeed = unfilteredMessageFeed.filter((message: MessageFeed) => {
            if (message.message.includes(searchInput)) {
                return true;
            }
        });
    }

    async function updateMessageFeed() {
        console.log('update message feeed')
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

                // This only adds person if it is not already added
                console.log('add person in updateMessageFeed')
                personOfMessage = addPerson(dm.pubkey)
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
                    name: (personOfMessage as NDKUser).profile?.name ?? (personOfMessage as NDKUser).npub.substring(0, 10),
                    pubkey: (personOfMessage as NDKUser).pubkey,
                    avatar: (personOfMessage as NDKUser).profile?.image ??
                        `https://robohash.org/${(personOfMessage as NDKUser).pubkey}`,
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
        if (currentPerson) {
            generateCurrentFeed();
        }
    }

    function expandContacts() {
        hideChat = true;
        hideSearch = true;
        arrowDown = false;
        contactsHeight = 'h-full';
    }

    function resetContactsList() {
        hideChat = false;
        hideSearch = false;
        arrowDown = true;
        contactsHeight = 'h-14';
    }

    onDestroy(()=>{
        myMessageFilter['authors'] = [];
        myMessageFilter['#t'] = [];

        receivedMessageFilter['#p'] = [];
        receivedMessageFilter['#t'] = [];

        messageStore.empty();
    });

    // If there is a logged in user, start receiving messages related to the ticket
    $: if ($ndk.activeUser && needSetup) {
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

        // If my ticket then add all people that created an offer on this ticket
        // and highlight winner offer if there is one
        // else add the ticket creator to people
        console.log('fetch ticket...')
        //  We must fetch this ticket once
        // to get the winner and the ticket title. 
        // myTickets does not necessarily contain this ticket at this point so it is easier this way
        $ndk.fetchEvent(ticketAddress).then((t: NDKEvent|null) => {
            needSetup = false;
            elemChat = elemChat;

            let ticketPubkey = ticketAddress.split(':')[1];
            if (t) {
                console.log('got ticket')
                ticket = TicketEvent.from(t);
                ticketTitle = 'Ticket: ' + ticket.title.substring(0, 20) + '...';
            }
            if (($ndk.activeUser as NDKUser).pubkey !== ticketPubkey) {
                console.log('addperson in fetchevent, NOT my ticket')
                addPerson(ticketPubkey);
            } else {
                // This is my ticket.
                myTicket = true;
                console.log('this is my ticket')
                const aTagFilters = offersOnTicketsFilter['#a'];
                if (!aTagFilters?.includes(ticketAddress)) {
                    offersOnTicketsFilter['#a']?.push(ticketAddress);
                    offersOnTickets.unsubscribe();
                    offersOnTickets.startSubscription();
                } else if(ticket) {
                    $offersOnTickets.forEach((offer: OfferEvent) => {
                        if (offer.referencedTicketAddress === ticketAddress) {
                            if ((ticket as TicketEvent).acceptedOfferAddress === offer.offerAddress) {
                                console.log('we got a winner in setup')
                                winner = offer.pubkey;
                            }
                        }
                    });
                }
            }
        });
    }

    $: if (ticket && myTicket && $offersOnTickets) {
        $offersOnTickets.forEach((offer: OfferEvent) => {
            if (offer.referencedTicketAddress === ticketAddress) {
                // If this is the winner offer, set winner
                if (!winner) {
                    if ((ticket as TicketEvent).acceptedOfferAddress === offer.offerAddress) {
                        console.log('we got a winner in arrived offers')
                        winner = offer.pubkey;
                    }
                }
                if (offer.pubkey !== ($ndk.activeUser as NDKUser).pubkey) {
                    addPerson(offer.pubkey);
                }
            }
        });
    }

    $: if (!needSetup && $messageStore.length > 0) {
        updateMessageFeed() 
    }

    let innerHeight = 0;
    $: if (innerHeight) {
        const elemPage = document.querySelector('#page');
        console.log(elemPage.offsetHeight)
        if (elemPage) {
            const promptHeight = elemPrompt.offsetHeight;
            const headerHeight = elemHeader.offsetHeight;
            chatHeight = (elemPage as HTMLElement).offsetHeight - promptHeight - headerHeight;
        }
    }

</script>

<svelte:window bind:innerHeight={innerHeight} />
<div class="h-full overflow-hidden">
    <div class="w-full h-full flex flex-col overflow-hidden card p-2 bg-surface-100-800-token">
        <section class="flex-none" bind:this={elemHeader}>
            <a class="anchor" href={titleLink}>
                <h4 class="h4 mb-2 text-center font-bold">{ticketTitle ?? '?'}</h4>
            </a>
            <!-- Top Navigation -->
            <div class="flex flex-col items-center md:hidden">
                <!-- Header -->
                <header class="p-2">
                    <input
                        class="input {hideSearch ? 'hidden' : ''}"
                        type="search"
                        placeholder="Search..."
                        bind:value={searchInput}
                        on:keyup={searchText}
                        on:search={searchText}
                    />
                </header>
                <!-- Contact List -->
                <div class="flex flex-col items-center p-2 pb-0 space-x-2">
                    <small class="opacity-50">Contacts</small>
                    <div class="flex flex-col space-y-1 overflow-y-hidden {contactsHeight}">
                        {#each people as person, i}
                            <button
                                type="button"
                                class="btn w-full flex items-center space-x-4 
                                {currentPerson 
                                ? (
                                person.pubkey === currentPerson.pubkey
                                ? 'variant-filled-primary'
                                : 'bg-surface-hover-token'
                                )
                                : 'bg-surface-hover-token'}"
                                on:click={() => selectCurrentPerson(person, i)}
                            >
                                <Avatar
                                    src={person.profile?.image
                                        ?? `https://robohash.org/${person.pubkey}`}
                                    width="w-8"
                                />
                                <span class="flex-1 text-start {person.pubkey === winner 
                                    ? 'text-warning-400 font-bold' : ''}">
                                    {person.profile?.name ?? person.npub.substring(0,15)}
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>
                <div class="flex w-full justify-center {arrowDown ? '' : 'sticky bottom-0'}">
                    <button 
                        class="btn btn-icon "
                        on:click={()=>{
                            if (arrowDown) {
                                expandContacts();
                            } else {
                                resetContactsList();
                            }
                        }}
                    >
                        <i class="fa-solid fa-chevron-{arrowDown ? 'down' : 'up'} text-xl"></i>
                    </button>
                </div>
            </div>
        </section>
        <section class="flex-auto overflow-hidden" >
            <div class="chat {hideChat ? 'hidden' : ''} w-full grid grid-cols-1 md:grid-cols-[30%_1fr]">
                <!-- Side Navigation -->
                <div class="hidden sticky top-0 z-20 md:grid grid-rows-[auto_1fr_auto] border-r border-surface-500/30">
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
                    <!-- Contact List -->
                    <div class="p-4 space-y-4">
                        <small class="opacity-50">Contacts</small>
                        <div class="flex flex-col space-y-1">
                            {#each people as person, i}
                                <button
                                    type="button"
                                    class="btn w-full flex items-center space-x-4
                                    {currentPerson 
                                    ? (
                                    person.pubkey === currentPerson.pubkey
                                    ? 'variant-filled-primary'
                                    : 'bg-surface-hover-token'
                                    )
                                    : 'bg-surface-hover-token'}"
                                    on:click={() => selectCurrentPerson(person, i)}                            >
                                    <Avatar
                                        src={person.profile?.image 
                                            ?? `https://robohash.org/${person.pubkey}`}
                                        width="w-8"
                                    />
                                    <span class="flex-1 text-start
                                        {person.pubkey === winner 
                                        ? 'text-warning-500 font-bold' : ''}">
                                        {person.profile?.name ?? person.npub.substring(0,10)}
                                    </span>
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>
                <!-- Conversation -->
                <!-- Inline css needed to adjust max-height after rendering -->
                <section 
                    bind:this={elemChat}
                    class="p-4 space-y-4 overflow-y-auto"
                    style="height: {chatHeight}px;"
                >
                    {#each filteredMessageFeed as bubble}
                        {#if bubble.host === true}
                            <div class="grid grid-cols-[auto_1fr] gap-2">
                                <Avatar
                                    src={bubble.avatar
                                        ?? `https://robohash.org/${bubble.pubkey}`}
                                    width="w-12" />
                                <div class="card p-4 variant-soft rounded-tl-none space-y-2">
                                    <header class="flex justify-between items-center gap-x-4">
                                        <p class="font-bold text-sm md:text-lg">{bubble.name}</p>
                                        <small class="opacity-50">{bubble.timestamp}</small>
                                    </header>
                                    <p>{bubble.message}</p>
                                </div>
                            </div>
                        {:else}
                            <div class="grid grid-cols-[1fr_auto] gap-2">
                                <div class="card p-4 rounded-tr-none space-y-2 {bubble.color}">
                                    <header class="flex justify-between items-center gap-x-4">
                                        <p class="font-bold text-sm md:text-lg">{bubble.name}</p>
                                        <small class="opacity-50">{bubble.timestamp}</small>
                                    </header>
                                    <p>{bubble.message}</p>
                                </div>
                                <Avatar 
                                    src={bubble.avatar
                                        ?? `https://robohash.org/${bubble.pubkey}`}
                                    width="w-12" />
                            </div>
                        {/if}
                    {/each}
                </section>
            </div>
        </section>
        <!-- Prompt -->
        <section
            bind:this={elemPrompt}
            class="flex-none w-full h-14 border-t border-surface-500/30
                    bg-surface-100-800-token p-2">
            <div class="input-group input-group-divider grid-cols-[auto_1fr_auto] rounded-container-token">
                <button class="input-group-shim">+</button>
                <textarea
                    bind:value={currentMessage}
                    class="bg-transparent border-0 ring-0 text-sm"
                    name="prompt"
                    id="prompt"
                    placeholder="Write a message..."
                    rows="1"
                    on:keydown={onPromptKeyDown}
                />
                <button class={currentMessage ? 'variant-filled-primary' : 'input-group-shim'} on:click={sendMessage}>
                    <i class="fa-solid fa-paper-plane" />
                </button>
            </div>
        </section>
    </div>
</div>
