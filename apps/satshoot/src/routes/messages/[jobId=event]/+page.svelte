<script lang="ts">
    import { page } from '$app/stores';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import { onDestroy, onMount } from 'svelte';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { Accordion, AccordionItem, Avatar, getToastStore } from '@skeletonlabs/skeleton';
    import {
        NDKEvent,
        NDKKind,
        NDKRelay,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
        type NDKSigner,
        type NDKUser,
    } from '@nostr-dev-kit/ndk';
    import { browser } from '$app/environment';
    import MessageCard from '$lib/components/Cards/MessageCard.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { getRoboHashPicture, orderEventsChronologically } from '$lib/utils/helpers';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';

    const toastStore = getToastStore();

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: searchTerms = searchQuery ? searchQuery.split(',') : [];

    const jobAddress = idFromNaddr($page.params.jobId);
    const relaysFromURL = relaysFromNaddr($page.params.jobId).split(',');
    let titleLink = '/' + $page.params.jobId;
    let jobTitle: string = 'Job: ?';
    if (relaysFromURL.length > 0) {
        relaysFromURL.forEach((relayURL: string) => {
            if (relayURL) {
                $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
            }
        });
    }

    let offersFilter: NDKFilter<NDKKind.FreelanceOffer> = {
        kinds: [NDKKind.FreelanceOffer],
        '#a': [jobAddress],
    };

    let offerStore: NDKEventStore<ExtendedBaseType<OfferEvent>>;

    let job: TicketEvent | null = null;
    let myJob = false;

    let initialized = false;

    interface Contact {
        person: NDKUser;
        selected: boolean;
    }

    let elemPage: HTMLElement;
    let elemChat: HTMLElement;
    let elemHeader: HTMLElement;
    let elemInput: HTMLElement;
    let elemContactsMobileView: HTMLElement;

    let chatHeight: number;

    let contactsOpen = false;
    let hideChat: boolean;
    let disablePrompt: boolean;
    let hideSearchIcon: boolean;

    let currentMessage: string = '';

    let searchInput = '';

    // Contact List
    let people: Contact[] = [];
    let currentPerson: NDKUser;

    // The pubkey of the person who made the winning Offer
    let winner = '';

    // Messages related to the job
    let jobMessages: NDKEventStore<NDKEvent>;

    // Filtered messages by person AND searchText
    let filteredMessageFeed: NDKEvent[] = [];

    // For some reason, eslint thinks ScrollBehavior is undefined...
    // eslint-disable-next-line no-undef
    function scrollChatBottom(behavior?: ScrollBehavior): void {
        elemChat.scrollTo({ top: elemChat.scrollHeight, behavior });
    }

    function isFirstMessageOfDay(messages: NDKEvent[], index: number): boolean {
        if (index === 0) return true;
        const currentDate = new Date(messages[index].created_at * 1000);
        const previousDate = new Date(messages[index - 1].created_at * 1000);
        return currentDate.toDateString() !== previousDate.toDateString();
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
            console.log('signer', dm.ndk?.signer);
            dm.kind = NDKKind.EncryptedDirectMessage;
            dm.tags.push(['t', jobAddress]);
            dm.tags.push(['p', currentPerson.pubkey]);

            console.log('dm before encryption', dm);
            dm.content = await ($ndk.signer as NDKSigner).encrypt(currentPerson, currentMessage);
            console.log('encrypted dm', dm);
            // Clear prompt
            currentMessage = '';

            const relays = await dm.publish();
            console.log('relays published', relays);
        }
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
        const person = $ndk.getUser({ pubkey: pubkey });
        // console.log('adding new person', person)
        const contact = { person: person, selected: false };

        people.push(contact);
        // console.log('updateUserProfile', user)
        people = people;

        await person.fetchProfile();
        people = people;
        currentPerson = currentPerson;
    }

    async function selectCurrentPerson(contact: Contact) {
        if (currentPerson !== contact.person) {
            console.log('selectCurrentPerson');
            if (job) {
                $selectedPerson = contact.person.pubkey + '$' + jobAddress;
                console.log($selectedPerson);
            }

            currentPerson = contact.person;

            people.forEach((c: Contact) => {
                c.selected = false;
            });

            contact.selected = true;

            people = people;

            contactsOpen = false;
            hideChat = false;
            disablePrompt = false;

            filteredMessageFeed = [];
        }
    }

    function onContactListExpanded() {
        // console.log('expandContacts')
        hideChat = true;
        disablePrompt = true;
        hideSearchIcon = true;
    }

    async function onContactListCOllapsed() {
        hideChat = false;
        disablePrompt = false;
        hideSearchIcon = false;
    }

    $: if (elemPage && elemHeader && elemInput) {
    }

    async function calculateHeights() {
        //
    }

    $: if (elemPage && elemHeader && elemInput && elemContactsMobileView) {
        const paddingsAndMargins = elemContactsMobileView.offsetHeight ? 95 : 80;

        chatHeight =
            elemPage.offsetHeight -
            elemHeader.offsetHeight -
            elemInput.offsetHeight -
            elemContactsMobileView.offsetHeight -
            paddingsAndMargins;
    }

    function peerFromMessage(message: NDKEvent): string | undefined {
        const peerPubkey =
            message.tagValue('p') === $currentUser!.pubkey ? message.pubkey : message.tagValue('p');

        return peerPubkey;
    }

    // New offer arrived: Add person if offer maker is part of WoT
    $: if (myJob && $offerStore) {
        $offerStore.forEach((offer: OfferEvent) => {
            if ($wot?.size > 1 && $wot.has(offer.pubkey)) {
                addPerson(offer.pubkey);
            }
        });
    }

    // New message arrived that is related to the job
    // If part of wot add message peer to Contacts
    // Render new message if there is a current chat partner selected
    $: if ($currentUser && $jobMessages?.length > 0) {
        $jobMessages = $jobMessages.filter((message: NDKEvent) => {
            const peer = peerFromMessage(message);

            // We always should have a peer defined
            if (!peer) return false;

            if ($wot?.size > 2 && $wot.has(peer)) {
                // Only try to add person if part of wot
                addPerson(peer);
                // Message can be displayed: It is related to job
                // AND it is related to user AND the peer is part of WoT
                return true;
            }

            return false;
        });

        if (currentPerson) {
            // Only render conversation with current person
            filteredMessageFeed = $jobMessages.filter((message: NDKEvent) => {
                const senderIsCurrentPerson = message.pubkey === currentPerson.pubkey;
                const recipientIsCurrentPerson =
                    (message.tagValue('p') as string) === currentPerson.pubkey;
                const relatedToCurrentPerson = senderIsCurrentPerson || recipientIsCurrentPerson;

                return relatedToCurrentPerson;
            });

            // We need messages in chronological order
            orderEventsChronologically(filteredMessageFeed, true);

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
    let innerWidth = 0;
    $: if (innerHeight || innerWidth) {
        calculateHeights();
    }

    $: if ($currentUser && job && !initialized) {
        initialized = true;
        // START MESSAGE STORE SUB
        const receivedMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#p': [$currentUser.pubkey],
            '#t': [jobAddress],
            limit: 50_000,
        };

        const sentMessageFilter: NDKFilter<NDKKind.EncryptedDirectMessage> = {
            kinds: [NDKKind.EncryptedDirectMessage],
            // set to user as soon as login happens
            authors: [$currentUser.pubkey],
            '#t': [jobAddress],
            limit: 50_000,
        };
        jobMessages = $ndk.storeSubscribe([receivedMessageFilter, sentMessageFilter], {
            autoStart: true,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: false,
            groupable: false,
        });

        // Add the right people to the contact list and select current chat partner
        if (($currentUser as NDKUser).pubkey !== job.pubkey) {
            // Not the users job
            console.log('NOT my job, adding job holder to persons...');
            addPerson(job.pubkey);
            const contact: Contact | undefined = people.find(
                (c: Contact) => c.person.pubkey === job!.pubkey
            );

            if (contact) selectCurrentPerson(contact);
        } else {
            // This is the users job
            myJob = true;
            console.log('this is my job');
            if (job.acceptedOfferAddress) {
                $ndk.fetchEvent(job.acceptedOfferAddress).then((offer) => {
                    if (offer) {
                        winner = offer.pubkey;
                    }
                });
            }

            if ($offerMakerToSelect) {
                console.log('offerMakerToSelect');
                addPerson($offerMakerToSelect);
                const contact: Contact | undefined = people.find(
                    (c: Contact) => c.person.pubkey == $offerMakerToSelect
                );
                // console.log('contact', contact)

                if (contact) selectCurrentPerson(contact);

                $offerMakerToSelect = '';
            } else if ($selectedPerson && $selectedPerson.split('$')[1] == jobAddress) {
                const pubkey = $selectedPerson.split('$')[0];
                addPerson(pubkey);
                const contact: Contact | undefined = people.find(
                    (c: Contact) => c.person.pubkey == pubkey
                );

                if (contact) selectCurrentPerson(contact);
            }
        }
    }

    $: if (browser) {
        if (contactsOpen) {
            onContactListExpanded();
        } else if (!contactsOpen) {
            onContactListCOllapsed();
        }
    }

    onMount(async () => {
        elemPage = document.querySelector('#page') as HTMLElement;
        onContactListExpanded();
        console.log('fetch job...');
        const jobEvent = await $ndk.fetchEvent(
            jobAddress,
            // Try to fetch latest state of the job
            // but fall back to cache
            { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL }
        );
        if (jobEvent) {
            job = TicketEvent.from(jobEvent);
            jobTitle = job.title.length < 21
                ? job.title
                : job.title.substring(0, 20) + '...'

            offerStore = $ndk.storeSubscribe<OfferEvent>(
                offersFilter,
                { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
                OfferEvent
            );
            // Fix chatHeight, recalc only on window resize or search text on mobile
            calculateHeights();
        }
    });

    onDestroy(() => {
        if (jobMessages) jobMessages.unsubscribe();
        if (offerStore) offerStore.unsubscribe();
    });
</script>

{#if $currentUser && job}
    <div class="w-full flex flex-col gap-0 flex-grow h-full">
        <div class="w-full h-full flex flex-col justify-center items-center pt-[15px]">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[10px] pb-1">
                    <!-- Title Card -->
                    <div bind:this={elemHeader}>
                        <Card classes="items-center">
                            <a
                                class="anchor font-[700] sm:text-[24px] justify-center"
                                href={titleLink}
                            >
                                {'Job: ' + (jobTitle ?? '?')}
                            </a>
                        </Card>
                    </div>

                    <!-- Contact List & Conversation Wrapper -->
                    <div
                        class="w-full h-full flex flex-col md:flex-row gap-[15px] flex-grow overflow-hidden"
                    >
                        <!-- Contact List (Desktop) -->
                        <Card classes="hidden md:flex flex-col flex-1 h-full overflow-hidden">
                            <div class="flex justify-center items-center">
                                <p
                                    class="font-[600] text-[20px] flex flex-row gap-[5px] items-center"
                                >
                                    Contacts
                                </p>
                            </div>
                            <div class="flex flex-col gap-[10px] overflow-y-auto flex-grow">
                                {#each people as contact, i (contact.person.pubkey)}
                                    <Button
                                        variant={contact.selected ? 'contained' : 'text'}
                                        on:click={() => selectCurrentPerson(contact)}
                                    >
                                        <Avatar
                                            src={contact.person.profile?.image ??
                                                getRoboHashPicture(contact.person.pubkey)}
                                            width="w-8"
                                        />
                                        <span
                                            class="flex-1 text-start
                                        {contact.person.pubkey === winner
                                                ? 'text-warning-500 font-bold'
                                                : ''}"
                                        >
                                            {contact.person.profile?.name ??
                                                contact.person.npub.substring(0, 10)}
                                        </span>
                                    </Button>
                                {/each}
                            </div>
                        </Card>

                        <!-- Contact List Dropdown (Mobile) -->
                        <div class="md:hidden w-full" bind:this={elemContactsMobileView}>
                            <Card classes="p-[10px">
                                <Accordion
                                    class="flex flex-col items-center bg-transparent relative"
                                >
                                    <AccordionItem bind:open={contactsOpen}>
                                        <svelte:fragment slot="lead">
                                            {#if currentPerson}
                                                <a href={'/' + currentPerson.npub}>
                                                    <Avatar
                                                        src={currentPerson.profile?.image ??
                                                            getRoboHashPicture(
                                                                currentPerson.pubkey
                                                            )}
                                                        width="w-8"
                                                    />
                                                </a>
                                            {/if}
                                        </svelte:fragment>
                                        <svelte:fragment slot="summary">
                                            {#if currentPerson}
                                                <span
                                                    class="flex-1 text-start
                                                    {currentPerson.pubkey === winner
                                                        ? 'text-warning-400 font-bold'
                                                        : ''}"
                                                >
                                                    {currentPerson.profile?.name ??
                                                        currentPerson.npub.substring(0, 15)}
                                                </span>
                                            {:else if people.length > 0}
                                                <div class="">Select Contact</div>
                                            {:else}
                                                <div>No Contacts</div>
                                            {/if}
                                        </svelte:fragment>
                                        <svelte:fragment slot="content">
                                            <!-- Absolutely positioned content -->
                                            <div
                                                class="absolute -bottom-[130px] left-0 right-0 overflow-hidden z-[100]"
                                            >
                                                <div
                                                    class="flex flex-col items-center p-2 pb-0 space-x-2"
                                                >
                                                    <Card
                                                        classes="overflow-y-auto shadow-deep border-[2px] border-black-100 dark:border-white-100 max-h-[200px]"
                                                    >
                                                        {#each people as contact, i}
                                                            <button
                                                                type="button"
                                                                class="btn w-full flex items-center space-x-4
                                                                {contact.selected
                                                                    ? 'variant-filled-primary'
                                                                    : 'bg-surface-hover-token'}"
                                                                on:click={() =>
                                                                    selectCurrentPerson(contact)}
                                                            >
                                                                <Avatar
                                                                    src={contact.person.profile
                                                                        ?.image ??
                                                                        getRoboHashPicture(
                                                                            contact.person.pubkey
                                                                        )}
                                                                    width="w-8"
                                                                />
                                                                <span
                                                                    class="flex-1 text-start
                                                                    {contact.person.pubkey ===
                                                                    winner
                                                                        ? 'text-warning-400 font-bold'
                                                                        : ''}"
                                                                >
                                                                    {contact.person.profile?.name ??
                                                                        contact.person.npub.substring(
                                                                            0,
                                                                            15
                                                                        )}
                                                                </span>
                                                            </button>
                                                        {/each}
                                                    </Card>
                                                </div>
                                            </div>
                                        </svelte:fragment>
                                    </AccordionItem>
                                </Accordion>
                            </Card>
                        </div>

                        <!-- Conversation -->
                        <Card classes="flex-[2] h-full overflow-hidden flex flex-col ">
                            <div
                                bind:this={elemChat}
                                class="flex flex-col flex-grow gap-[5px] overflow-y-auto p-[5px]"
                                style="height: {chatHeight}px;"
                            >
                                {#if $currentUser}
                                    {#each filteredMessageFeed as message, index (message.id)}
                                        <MessageCard
                                            avatarRight={message.pubkey !== $currentUser.pubkey}
                                            {message}
                                            {searchTerms}
                                            isFirstOfDay={isFirstMessageOfDay(
                                                filteredMessageFeed,
                                                index
                                            )}
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
                            </div>
                        </Card>
                    </div>

                    <!-- Input Wrapper -->
                    <div bind:this={elemInput}>
                        <Card classes="flex flex-row">
                            <div
                                class="input-group input-group-divider grid-cols-[1fr_auto] rounded-container-token"
                            >
                                <textarea
                                    bind:value={currentMessage}
                                    class="bg-transparent border-0 ring-0 text-sm"
                                    name="prompt"
                                    id="prompt"
                                    placeholder="DON'T TYPE SECRETS HERE"
                                    rows="1"
                                    on:keydown={onPromptKeyDown}
                                    disabled={disablePrompt}
                                />
                                <button
                                    class={currentMessage
                                        ? 'variant-filled-primary'
                                        : 'input-group-shim'}
                                    on:click={sendMessage}
                                >
                                    <i class="fa-solid fa-paper-plane" />
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div class="w-full">
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
    </div>
{/if}
