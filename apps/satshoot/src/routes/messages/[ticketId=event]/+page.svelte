<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/user";
    import { page } from "$app/stores";

    import { wot } from "$lib/stores/wot";

    import { 
        offerMakerToSelect,
        selectedPerson,
    } from "$lib/stores/messages";
    
    import { onDestroy, onMount, tick } from "svelte";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';

    import {
        NDKEvent,
        NDKKind,
        type NDKUser,
        type NDKSigner,
        NDKRelay,
        type NDKFilter,
        NDKSubscriptionCacheUsage,
    } from "@nostr-dev-kit/ndk";

    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19'
    import { wordlist } from "@scure/bip39/wordlists/english";
    import { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import SearchIcon from "$lib/components/Icons/SearchIcon.svelte";
    import MessageCard from "$lib/components/User/MessageCard.svelte";
    import type { ExtendedBaseType, NDKEventStore } from "@nostr-dev-kit/ndk-svelte";


    const toastStore = getToastStore();

    const ticketAddress = idFromNaddr($page.params.ticketId);
    const relaysFromURL = relaysFromNaddr($page.params.ticketId).split(',');
    let titleLink = '/' + $page.params.ticketId;
    let ticketTitle:string = 'Ticket: ?';
    if (relaysFromURL.length > 0) {
        relaysFromURL.forEach((relayURL: string) => {
            if (relayURL) {
                $ndk.pool.addRelay(new NDKRelay(relayURL));
            }
        });
    }

    let offersFilter: NDKFilter<NDKKind.TroubleshootOffer> = {
        kinds: [NDKKind.TroubleshootOffer],
        '#a': [ticketAddress],
    }

    let offerStore: NDKEventStore<ExtendedBaseType<OfferEvent>>;

    let ticket: TicketEvent | null = null;
    let myTicket = false;

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
    let warned = false;

	// Contact List
	let people: Contact[] = [];
    let currentPerson: NDKUser;

    // The pubkey of the person who made the winning Offer
    let winner = '';

    // Messages related to the ticket
    let ticketMessages: NDKEventStore<NDKEvent>;

    // Filtered messages by person AND searchText 
	let filteredMessageFeed: NDKEvent[] = [];

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
            console.log('signer', dm.ndk?.signer)
            dm.kind = NDKKind.EncryptedDirectMessage;
            dm.tags.push(['t', ticketAddress]);
            dm.tags.push(['p', currentPerson.pubkey]);

            console.log('dm before encryption', dm)
            dm.content = await ($ndk.signer as NDKSigner).encrypt(currentPerson, currentMessage);
            console.log('encrypted dm', dm)
            // Clear prompt
            currentMessage = '';

            const relays = await dm.publish();
            console.log('relays published', relays)
        }
	}

    $: if(currentMessage && !warned) {
        wordlist.forEach((bip39Word: string) => {
            const lowerCaseText = currentMessage.toLowerCase();
            const words = lowerCaseText.split(' ');
            words.forEach((word:string) => {
                if (word === bip39Word) {
                    console.log('current message', currentMessage)
                    const t: ToastSettings = {
                        message: 'WARNING SECRET WORD TYPED IN!\
                        NEVER SHARE SECRETS IN THIS CHAT!',
                        autohide: false,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                    warned = true;
                }
            });
        });
    }

	function onPromptKeyDown(event: KeyboardEvent) {
        if (currentMessage) {
            if (['Enter'].includes(event.code)) {
                event.preventDefault();
                sendMessage();
            }
        }
	}

    async function addPerson(pubkey: string) {
        for (const contact of people) {
            if (contact.person.pubkey === pubkey) {
                return;
            }
        }
        
        // We havent added this person yet
        const person = $ndk.getUser({pubkey: pubkey});
        // console.log('adding new person', person)
        const contact = {person: person, selected: false};

        people.push(contact);
        // console.log('updateUserProfile', user)
        people = people;

        await person.fetchProfile();
        people = people;
    }

    async function selectCurrentPerson(contact: Contact) {
        if (currentPerson !== contact.person) {
            console.log('selectCurrentPerson')
            if (ticket) {
                $selectedPerson = contact.person.pubkey + '$' + ticketAddress;
                console.log($selectedPerson)
            }

            currentPerson = contact.person;
            
            people.forEach((c: Contact) => {
                c.selected = false;
            });

            contact.selected = true;

            people = people;

            resetContactsList();
            await tick();

            calculateHeights();

            filteredMessageFeed = [];
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

    function peerFromMessage(message: NDKEvent):string | undefined {
        const peerPubkey = (
            message.tagValue('p') === $currentUser!.pubkey
            ? message.pubkey : message.tagValue('p')
        );

        return peerPubkey;
    }

    // New offer arrived: Add person if offer maker is part of WoT
    $: if (myTicket && $offerStore) {
        $offerStore.forEach((offer: OfferEvent) => {
            if ($wot?.size > 1 && $wot.has(offer.pubkey)) {
                addPerson(offer.pubkey);
            }
        });
    }

    // New message arrived that is related to the ticket
    // If part of wot add message peer to Contacts
    // Render new message if there is a current chat partner selected
    $: if ($currentUser && $ticketMessages?.length > 0) {
        $ticketMessages = $ticketMessages.filter((message: NDKEvent) => {
            const peer = peerFromMessage(message);

            // We always should have a peer defined
            if (!peer) return false;

            if ($wot?.size > 1 && $wot.has(peer)) {
                // Only try to add person if part of wot
                addPerson(peer);
                // Message can be displayed: It is related to ticket
                // AND it is related to user AND the peer is part of WoT
                return true;
            }

            return false;
        });

        if (currentPerson) {
            // Only render conversation with current person
            filteredMessageFeed = $ticketMessages.filter((message: NDKEvent) =>{
                const senderIsCurrentPerson = 
                    (message.pubkey === currentPerson.pubkey);
                const recipientIsCurrentPerson = 
                    (message.tagValue('p') as string === currentPerson.pubkey);
                const relatedToCurrentPerson = 
                    senderIsCurrentPerson || recipientIsCurrentPerson;

                return relatedToCurrentPerson;
            });

            // We need messages in reverse chronological order
            filteredMessageFeed.reverse();

            // Smooth scroll to bottom
            // Timeout prevents race condition
            if (elemChat) {
                setTimeout(() => {
                    scrollChatBottom('smooth');
                }, 0);
            }
        }
    }

    let innerHeight = 0;
    let innerWidth = 0
    $: if (innerHeight || innerWidth) {
        calculateHeights();
    }

    $: if ($currentUser && ticket) {
        // START MESSAGE STORE SUB
        const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#p': [$currentUser.pubkey],
            '#t': [ticketAddress], 
            limit: 50_000,
        };

        const sentMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
            kinds: [NDKKind.EncryptedDirectMessage],
            // set to user as soon as login happens
            authors: [$currentUser.pubkey],
            '#t': [ticketAddress], 
            limit: 50_000,
        }
        ticketMessages = $ndk.storeSubscribe(
            [receivedMessageFilter, sentMessageFilter],
            {
                autoStart: true,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                closeOnEose: false,
                groupable: false
            },
        );

        // Add the right people to the contact list and select current chat partner
        if (($currentUser as NDKUser).pubkey !== ticket.pubkey) {
            // Not the users ticket
            console.log('NOT my ticket, adding ticket holder to persons...')
            addPerson(ticket.pubkey);
            const contact: Contact|undefined = people.find((c: Contact) =>
                c.person.pubkey === ticket!.pubkey
            );

            if(contact) selectCurrentPerson(contact);
        } else {
            // This is the users ticket
            myTicket = true;
            console.log('this is my ticket')
            if (ticket.acceptedOfferAddress) {
                $ndk.fetchEvent(ticket.acceptedOfferAddress).then((offer) => {
                    if (offer) {
                        winner = offer.pubkey;
                    }
                });
            }

            if($offerMakerToSelect) {
                console.log('offerMakerToSelect')
                addPerson($offerMakerToSelect)
                const contact: Contact|undefined = people.find((c: Contact) =>
                    c.person.pubkey == $offerMakerToSelect
                );
                // console.log('contact', contact)

                if(contact) selectCurrentPerson(contact);

                $offerMakerToSelect = '';
            } else if($selectedPerson && ($selectedPerson.split('$')[1] == ticketAddress)) {
                console.log('select person that was previously selected', $selectedPerson)
                const pubkey = $selectedPerson.split('$')[0];
                addPerson(pubkey);
                const contact: Contact|undefined = people.find((c: Contact) =>
                    c.person.pubkey == pubkey
                );

                if(contact) selectCurrentPerson(contact);
            }
        }
    }

    onMount(async () => {
        expandContacts();
        console.log('fetch ticket...')
        const ticketEvent = await $ndk.fetchEvent(
            ticketAddress,
            // Try to fetch latest state of the ticket
            // but fall back to cache
            {cacheUsage: NDKSubscriptionCacheUsage.PARALLEL}
        );
        if (ticketEvent) {
            console.log('got ticket')
            ticket = TicketEvent.from(ticketEvent);
            ticketTitle = 'Ticket: ' + ticket.title.substring(0, 20) + '...';
            offerStore = $ndk.storeSubscribe<OfferEvent>(
                offersFilter,
                {closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST},
                OfferEvent
            );
        }
        elemChat = elemChat;
    });

    onDestroy(() => {
        if (ticketMessages) ticketMessages.empty();
        if (offerStore) offerStore.empty();
    });

</script>

<svelte:window bind:innerHeight={innerHeight} bind:innerWidth={innerWidth}/>
<div class="h-full overflow-hidden">
    <div class="w-full h-full flex flex-col overflow-hidden card bg-surface-100-800-token">
        {#if $currentUser && ticket}
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
                        {#if $currentUser}
                            {#each filteredMessageFeed as message(message.id)}
                                <MessageCard
                                    avatarRight={message.pubkey !== $currentUser.pubkey}
                                    {message}
                                    searchText={searchInput}
                                />
                            {/each}
                        {:else}
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
                        {/if}
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
                        />
                    </div>
                    <div class="input-group input-group-divider grid-cols-[1fr_auto] rounded-container-token">
                        <!-- <button class="input-group-shim">+</button> -->
                        <textarea
                            bind:value={currentMessage}
                            class="bg-transparent border-0 ring-0 text-sm"
                            name="prompt"
                            id="prompt"
                            placeholder="DON'T TYPE SECRETS HERE"
                            rows="1"
                            on:keydown={onPromptKeyDown}
                        />
                        <button 
                            class={
                                currentMessage 
                                ? 'variant-filled-primary' 
                                : 'input-group-shim'
                            }
                            on:click={sendMessage}
                        >
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
    <div class="fixed bottom-[11rem] sm:bottom-[13rem] right-4">
        <button class="md:hidden btn btn-icon bg-primary-300-600-token"
            on:click={async ()=> {
                hideSearch = !hideSearch;
                await tick();
                calculateHeights();
            }}
        >
            <SearchIcon />
        </button>
    </div>
{/if}
