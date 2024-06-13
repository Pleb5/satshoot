<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/user";
    import { page } from "$app/stores";

    import { allOffers } from "$lib/stores/troubleshoot-eventstores";

    import { 
        wotFilteredMessageFeed,
        offerMakerToSelect,
        selectedPerson,
        type Message,
    } from "$lib/stores/messages";
    
    import { onMount, tick } from "svelte";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';

    import {
        NDKEvent,
        NDKKind,
        type NDKUser,
        type NDKSigner,
        type NDKTag,

        type Hexpubkey

    } from "@nostr-dev-kit/ndk";

    import { idFromNaddr } from '$lib/utils/nip19'
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import SearchIcon from "$lib/components/Icons/SearchIcon.svelte";
    import MessageCard from "$lib/components/User/MessageCard.svelte";


    const toastStore = getToastStore();

    const ticketAddress = idFromNaddr($page.params.ticketId);
    let titleLink = '/' + $page.params.ticketId;
    let ticketTitle:string = 'Ticket: ?';

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

    let needSetup = true;

	// Contact List
	let people: Contact[] = [];
    let currentPerson: NDKUser;

    // The pubkey of the person who made the winning Offer
    let winner = '';

    // Filtered messages by person AND searchText 
	let unfilteredMessageFeed: Message[] = [];
	let filteredMessageFeed: Message[] = [];

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

            // console.log('dm', dm)

            console.log('dm before encryption', dm)
            dm.content = await ($ndk.signer as NDKSigner).encrypt(currentPerson, currentMessage);
            console.log('encrypted dm', dm)
            // Clear prompt
            currentMessage = '';

            await dm.publish();
        }
	}

	function onPromptKeyDown(event: KeyboardEvent) {
		if (['Enter'].includes(event.code)) {
			event.preventDefault();
			sendMessage();
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
        if (currentPerson !== contact.person){
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
        }
    }

    function generateCurrentFeed() {
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
        filteredMessageFeed = unfilteredMessageFeed.filter((message: Message) => {
            if (message.message.includes(searchInput)) {
                return true;
            }
        });
        console.log('decrypted, filtered MessageFeed', filteredMessageFeed)
    }

    async function updateMessageFeed() {
        // The message was either sent from the current chat partner to the user
        // or it was sent from the user to the current partner. We need both
        // We also filter messages related to the ticket the conversation is about
        console.log('wotFilteredMessageFeed', $wotFilteredMessageFeed)
        const feed = $wotFilteredMessageFeed.filter((message: NDKEvent) =>{
            let relatedToTicket = false;
            message.tags.forEach((tag: NDKTag) => {
                if (tag[0] === 't' && tag[1] === ticket!.ticketAddress) {
                    relatedToTicket = true;
                }
            });

            return (
                relatedToTicket &&
                (message.pubkey === currentPerson.pubkey ||
                message.tagValue('p') as string === currentPerson.pubkey)
            )
        });
        console.log('feed to decrypt', feed)
        console.log('update message feed')
        for (let i = 0; i < feed.length; i++) {
            const dm = feed[i];
            const messageDate = new Date(dm.created_at as number * 1000);
            // Time is shown in local time zone
            const dateString = messageDate.toLocaleString();

            // the message iteself is decrypted later, init with empty string for now
            const message = {
                id: dm.id,
                sender: dm.pubkey,
                recipient: dm.tagValue('p') as string,
                timestamp: dateString,
                message: '',
            };

            // We dont decrypt already decrypted messages
            let alreadySeen = false;
            for (const m of unfilteredMessageFeed) {
                if (dm.id === m.id) {
                    alreadySeen = true;
                    console.log('already seen')
                    break;
                }
            }
            if (alreadySeen) continue;

            // We insert the new decrypted message in the right place
            // that is exactly the index where it was in the original feed
            // because that is inherently ordered by time by ndk-svelte store
            // This insert is important to happen BEFORE decryption to avoid
            // race conditions arising from waiting on the decryption
            // also, ndk has the newest event at the start and we need it to be at the end...
            unfilteredMessageFeed.splice(unfilteredMessageFeed.length - i, 0, message);


            // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
            // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
            // 
            // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

            // ALWAYS USE OTHER USER REGARDLESS OF WHO SENT THE MESSAGE
            console.log('start decryption', dm)
            try {
                const peerPubkey = (dm.tagValue('p') === $currentUser!.pubkey
                    ? dm.pubkey : dm.tagValue('p')
                ) as string;
                addPerson(peerPubkey);

                const peerUser = $ndk.getUser({pubkey: peerPubkey});

                const decryptedDM = await ($ndk.signer as NDKSigner).decrypt(peerUser, dm.content); 

                console.log('decrypted message:', decryptedDM)
                message.message = decryptedDM;
            } catch (e) {
                console.log(e);
                console.trace();
            }
        }
        console.log('decrypted feed', unfilteredMessageFeed)

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

    // If there is a logged in user, start receiving messages related to the ticket
    $: if ($currentUser && needSetup) {
        // If my ticket then add all people that created an offer on this ticket
        // and highlight winner offer if there is one
        // else add the ticket creator to people
        //  We must fetch this ticket once
        // to get the winner and the ticket title. 
        // myTickets does not necessarily contain this ticket at this point so it is easier this way
        console.log('fetch ticket...')
        $ndk.fetchEvent(ticketAddress).then((t: NDKEvent|null) => {
            needSetup = false;
            elemChat = elemChat;

            let ticketPubkey = ticketAddress.split(':')[1];
            if (t) {
                console.log('got ticket')
                ticket = TicketEvent.from(t);
                ticketTitle = 'Ticket: ' + ticket.title.substring(0, 20) + '...';
            }
            if (($currentUser as NDKUser).pubkey !== ticketPubkey) {
                console.log('addperson in fetchevent, NOT my ticket')
                addPerson(ticketPubkey);
                const contact: Contact|undefined = people.find((c: Contact) =>
                    c.person.pubkey == ticketPubkey
                );

                if(contact) selectCurrentPerson(contact);
            } else {
                // This is my ticket.
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
                myTicket = true;
                console.log('this is my ticket')
                if(ticket) {
                    $allOffers.forEach((offer: OfferEvent) => {
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

    $: if (ticket && myTicket && $allOffers) {
        $allOffers.forEach((offer: OfferEvent) => {
            if (offer.referencedTicketAddress === ticketAddress) {
                // If this is the winner offer, set winner
                if (!winner) {
                    if ((ticket as TicketEvent).acceptedOfferAddress === offer.offerAddress) {
                        console.log('we got a winner in arrived offers')
                        winner = offer.pubkey;
                    }
                }
                addPerson(offer.pubkey);
            }
        });
    }

    $: if (!needSetup && $wotFilteredMessageFeed.length > 0) {
        // Add all people to contact list who have messages related to ticket
        let relatedToTicket = false;
        $wotFilteredMessageFeed.forEach((message: NDKEvent) => {
            message.tags.forEach((tag: NDKTag) => {
                if (tag[0] === 't' && tag[1] === ticket!.ticketAddress) {
                    relatedToTicket = true;
                    if (message.pubkey !== $currentUser!.pubkey) {
                        addPerson(message.pubkey);
                    }
                }
            });
        });

        if (currentPerson) {
            updateMessageFeed();
        }
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
                        {#if $currentUser}
                            {#each filteredMessageFeed as message}
                                <MessageCard
                                avatarRight={message.sender !== $currentUser.pubkey}
                                message={message}
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
                            on:keyup={searchText}
                            on:search={searchText}
                        />
                    </div>
                    <div class="input-group input-group-divider grid-cols-[1fr_auto] rounded-container-token">
                        <!-- <button class="input-group-shim">+</button> -->
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
