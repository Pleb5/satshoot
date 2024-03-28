<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { page } from "$app/stores";

    import { messageStore, receivedMessageFilter, myMessageFilter } from "$lib/stores/messages";
    import { offersOnTickets, offersOnTicketsFilter } from "$lib/stores/troubleshoot-eventstores";

    import { onDestroy, onMount, tick } from "svelte";

	import { Avatar } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { NDKEvent, NDKKind, type NDKUser } from "@nostr-dev-kit/ndk";

    import { idFromNaddr } from '$lib/utils/nip19'
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";


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

    interface Contact {
        person: NDKUser,
        selected: boolean,
    }

	let elemChat: HTMLElement;
    let elemHeader:HTMLElement;
    let elemSideHeader:HTMLElement;
    let elemPrompt:HTMLElement;
    let elemSideContactListDiv:HTMLElement;

    let sideContactsLabelOffsetHeight: number;
    let chatHeight: number;
    let sideContactsHeight: number;

    let hideChat:boolean;
    let hidePrompt:boolean;
    let contactsHeight:string;
    let arrowDown:boolean;
    let hideSearch:boolean = true;
    let hideSearchIcon:boolean;

    let currentMessage: string = '';


    let searchInput = '';

    let needSetup = true;

	// Contact List
	let people: Contact[] = [];
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

            // console.log('dm', dm)

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
            // console.log('updateUserProfile', user)
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
        for (const contact of people) {
            if (contact.person.pubkey === pubkey) {
                return contact.person;
            }
        }
        
        // We havent added this person yet
        const person = $ndk.getUser({hexpubkey: pubkey});
        // console.log('adding new person', person)
        const contact = {person: person, selected: false};
        people.push(contact);
        people = people;

        updateUserProfile(person);

        return person;
    }

    async function selectCurrentPerson(contact: Contact) {
        if (currentPerson !== contact.person){
            // console.log('selectCurrentPerson')
            currentPerson = contact.person;
            
            people.forEach((c: Contact) => {
                c.selected = false;
            });

            contact.selected = true;

            people = people;

            generateCurrentFeed();
            updateUserProfile(currentPerson);
            resetContactsList();

            await tick();
            calculateHeights();
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
        // console.log('update message feeed')
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
                // console.log('add person in updateMessageFeed')
                personOfMessage = addPerson(dm.pubkey)
            }

            try {
                // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
                // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
                // 
                // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

                // ALWAYS USE OTHER USER REGARDLESS OF WHO SENT THE MESSAGE
                await dm.decrypt(otherUser); 

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
                console.trace();
            }
        }

        // Update the message feed
        if (currentPerson) {
            generateCurrentFeed();
        }
    }

    function expandContacts() {
        // console.log('expandContacts')
        hideChat = true;
        hidePrompt = true;
        hideSearchIcon = true;
        arrowDown = false;
        contactsHeight = 'h-full';
    }

    function resetContactsList() {
        let anyoneSelected = false;
        people.forEach((contact: Contact) => {
            if(contact.selected) {
                anyoneSelected = true;
            }
        });
        if(!anyoneSelected && people.length > 0) {
           selectCurrentPerson(people[0]); 
        }
         
        hideChat = false;
        hidePrompt = false;
        hideSearchIcon = false;
        arrowDown = true;
        contactsHeight = 'h-14';
    }

    function calculateHeights() {
        const elemPage = document.querySelector('#page');
        if (elemPage && elemPrompt && elemHeader && elemSideHeader) {
            // console.log('recalculate chat and sideContactsHeight')
            const promptHeight = elemPrompt.offsetHeight;
            const headerHeight = elemHeader.offsetHeight;
            chatHeight = (elemPage as HTMLElement).offsetHeight - promptHeight - headerHeight;

            const sideHeaderHeight = elemSideHeader.offsetHeight;
            const sideContactsListDivPaddingHeight = parseInt(window.getComputedStyle(
                elemSideContactListDiv).paddingTop) * 2;

            sideContactsHeight = chatHeight - sideHeaderHeight
                - sideContactsLabelOffsetHeight - sideContactsListDivPaddingHeight;
            // console.log('promptHeight', promptHeight)
            // console.log('headerHeight', headerHeight)
            // console.log('sideHeaderHeight', sideHeaderHeight)
            // console.log('sideContactsLabelOffsetHeight', sideContactsLabelOffsetHeight)
            // console.log('sideContactsListDivPaddingHeight', sideContactsListDivPaddingHeight)
            // console.log('chatHeight', chatHeight)
            // console.log('sideContactsHeight', sideContactsHeight)
        } else {
            // console.log('not calculateHeights, reason:')
            // console.log(elemPage)
            // console.log(elemPrompt)
            // console.log(elemHeader)
            // console.log(elemSideHeader)
        }
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
        // If my ticket then add all people that created an offer on this ticket
        // and highlight winner offer if there is one
        // else add the ticket creator to people
        //  We must fetch this ticket once
        // to get the winner and the ticket title. 
        // myTickets does not necessarily contain this ticket at this point so it is easier this way
        console.log('fetch ticket...')
        $ndk.fetchEvent(ticketAddress).then((t: NDKEvent|null) => {
            // Possible problem here to start the start message subscriptions before ticket arrived
            // updateMessageFeed() might be called too soon in reactive statements below
            // Sometimes this throws a very obscure error so try to initiate message subs here
            myMessageFilter['authors'] = [];
            myMessageFilter['authors'].push(($ndk.activeUser as NDKUser).pubkey);
            myMessageFilter['#t'] = [];
            myMessageFilter['#t'].push(ticketAddress);

            receivedMessageFilter['#p'] = [];
            receivedMessageFilter['#p'].push(($ndk.activeUser as NDKUser).pubkey);
            receivedMessageFilter['#t'] = [];
            receivedMessageFilter['#t'].push(ticketAddress);

            messageStore.empty();
            messageStore.startSubscription();

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
    let innerWidth = 0
    $: if (innerHeight || innerWidth) {
        calculateHeights();
    }

    onMount(() => {
        expandContacts();
    });

</script>

<svelte:window bind:innerHeight={innerHeight} bind:innerWidth={innerWidth}/>
<div class="h-full overflow-hidden">
    <div class="w-full h-full flex flex-col overflow-hidden card bg-surface-100-800-token">
        {#if ticket}
            <section class="flex-none pt-2" bind:this={elemHeader}>
                <a class="anchor" href={titleLink}>
                    <h4 class="h4 mb-2 text-center font-bold">{ticketTitle ?? '?'}</h4>
                </a>
                <!-- Top Navigation -->
                <div class="flex flex-col items-center md:hidden">
                    <div class="flex gap-x-2 ">
                        <!-- Contact List -->
                        <div class="flex flex-col items-center p-2 pb-0 space-x-2">
                            <small class="opacity-50">Contacts</small>
                            <div class="flex flex-col space-y-1 overflow-y-hidden {contactsHeight}">
                                {#each people as contact, i}
                                    <button
                                        type="button"
                                        class="btn w-full flex items-center space-x-4 
                                        { contact.selected
                                        ? 'variant-filled-primary'
                                        : 'bg-surface-hover-token'
                                        }
                                        { !contact.selected && arrowDown
                                        ? 'hidden'
                                        : ''
                                        }
                                        "
                                        on:click={() => selectCurrentPerson(contact)}
                                    >
                                        <Avatar
                                            src={contact.person.profile?.image
                                                ?? `https://robohash.org/${contact.person.pubkey}`}
                                            width="w-8"
                                        />
                                        <span class="flex-1 text-start {contact.person.pubkey === winner 
                                            ? 'text-warning-400 font-bold' : ''}">
                                            {contact.person.profile?.name ?? contact.person.npub.substring(0,15)}
                                        </span>
                                    </button>
                                {/each}
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
                    </div>
                </div>
            </section>
            <section class="flex-auto overflow-hidden" >
                <div class="chat w-full grid grid-cols-1 md:grid-cols-[30%_1fr]">
                    <!-- Side Navigation -->
                    <div class="hidden md:grid grid-rows-[auto_1fr_auto] border-r border-surface-500/30">
                        <!-- Header -->
                        <header class="border-b border-surface-500/30 p-4" bind:this={elemSideHeader}>
                            <input
                                class="input"
                                type="search"
                                placeholder="Search Messages..."
                                bind:value={searchInput}
                                on:keyup={searchText}
                            />
                        </header>
                        <!-- Contact List -->
                        <div class="p-4  space-y-4" bind:this={elemSideContactListDiv}>
                            <small class="opacity-50" bind:offsetHeight={sideContactsLabelOffsetHeight}>
                                Contacts
                            </small>
                            <div
                                class="flex flex-col space-y-1 overflow-y-auto"
                                style="height: {sideContactsHeight}px; margin:0"
                            >
                                {#each people as contact, i (contact.person.pubkey)}
                                    <button
                                        type="button"
                                        class="btn w-full flex items-center space-x-4
                                        {contact.selected
                                        ? 'variant-filled-primary'
                                        : 'bg-surface-hover-token'
                                        }"
                                        on:click={() => selectCurrentPerson(contact)}
                                    >
                                        <Avatar
                                            src={contact.person.profile?.image 
                                                ?? `https://robohash.org/${contact.person.pubkey}`}
                                            width="w-8"
                                        />
                                        <span class="flex-1 text-start
                                            {contact.person.pubkey === winner 
                                            ? 'text-warning-500 font-bold' : ''}">
                                            {contact.person.profile?.name ?? contact.person.npub.substring(0,10)}
                                        </span>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>
                    <!-- Conversation -->
                    <!-- Inline css needed to adjust height reactively -->
                    <section 
                        bind:this={elemChat}
                        class="p-4 space-y-4 overflow-y-auto {hideChat ? 'hidden' : ''}"
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
            {#if !hidePrompt}
                <section
                    bind:this={elemPrompt}
                    class="flex-none flex flex-col w-full border-t border-surface-500/30
                    bg-surface-100-800-token p-2"
                >
                    <div class="{hideSearch ? 'hidden' : ''} md:hidden p-2">
                        <!-- On some devices a little 'x' icon clears the input, triggering on:search event -->
                        <input
                            class="input"
                            type="search"
                            placeholder="Search Messages..."
                            bind:value={searchInput}
                            on:keyup={searchText}
                            on:search={searchText}
                        />
                    </div>
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
            {/if}
        {:else }
            <section class="w-full ">
                <div class="p-4 space-y-4">
                    <div class="placeholder animate-pulse" />
                    <div class="grid grid-cols-3 gap-8">
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                    </div>
                    <div class="grid grid-cols-4 gap-4">
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                        <div class="placeholder animate-pulse" />
                    </div>
                </div>
            </section>
        {/if}
    </div>
</div>

<!-- Search on narrow screens -->
{#if !hideSearchIcon}
    <div class="fixed bottom-[7.75rem] sm:bottom-[8.15rem] right-4">
        <button class="md:hidden btn btn-icon bg-primary-300-600-token"
            on:click={async ()=> {
                hideSearch = !hideSearch;
                await tick();
                calculateHeights();
            }}
        >
            <span class="">
                <i class="fa-solid fa-magnifying-glass text-lg"></i>
            </span>
        </button>
    </div>
{/if}
