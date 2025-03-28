<script lang="ts">
    import { page } from '$app/state';
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

    interface Contact {
        person: NDKUser;
        selected: boolean;
    }

    const toastStore = getToastStore();

    // ======================
    // 1. URL & Search Params
    // ======================
    const searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    const searchTerms = $derived(searchQuery ? searchQuery.split(',') : []);
    const jobAddress = idFromNaddr(page.params.jobId);
    const relaysFromURL = relaysFromNaddr(page.params.jobId).split(',');
    let titleLink = '/' + page.params.jobId;
    let jobTitle = $state('Job: ?');

    // ======================
    // 2. State Definitions
    // ======================
    let job = $state<TicketEvent | null>(null);
    let myJob = $state(false);
    let initialized = $state(false);
    let currentMessage = $state('');
    let winner = $state(''); // Pubkey of winning offer maker
    let contactsOpen = $state(false);
    let disablePrompt = $state<boolean>();
    let hideChat = $state(false);
    let hideSearchIcon = $state(false);

    // DOM Elements
    let elemPage = $state<HTMLElement>();
    let elemChat = $state<HTMLElement>();
    let elemHeader = $state<HTMLElement>();
    let elemInput = $state<HTMLElement>();
    let elemContactsMobileView = $state<HTMLElement>();

    // Contact List
    let people = $state<Contact[]>([]);
    let currentPerson = $state<NDKUser>();

    // Message Stores
    let jobMessages = $state<NDKEventStore<NDKEvent>>(); // Messages related to the job
    let offerStore = $state<NDKEventStore<ExtendedBaseType<OfferEvent>>>();

    // ======================
    // 3. Derived Values
    // ======================
    const chatHeight = $derived.by(() => {
        if (elemPage && elemHeader && elemInput && elemContactsMobileView) {
            const paddingsAndMargins = elemContactsMobileView.offsetHeight ? 95 : 80;
            return (
                elemPage.offsetHeight -
                elemHeader.offsetHeight -
                elemInput.offsetHeight -
                elemContactsMobileView.offsetHeight -
                paddingsAndMargins
            );
        }
    });

    const wotFilteredMessages = $derived.by(() => {
        if (!$currentUser || !$jobMessages?.length) return [];
        return $jobMessages.filter((message) => {
            const peer = peerFromMessage(message);
            return peer && $wot?.size > 2 && $wot.has(peer);
        });
    });

    const currentPersonMessages = $derived.by(() => {
        if (!currentPerson || !wotFilteredMessages.length) return [];
        return wotFilteredMessages.filter((message) => {
            return (
                message.pubkey === currentPerson!.pubkey ||
                message.tagValue('p') === currentPerson!.pubkey
            );
        });
    });

    const orderedMessages = $derived.by(() => {
        const copy = [...currentPersonMessages];
        orderEventsChronologically(copy, true);
        return copy;
    });

    // ======================
    // 4. Initial Setup
    // ======================
    // Add relays from URL
    if (relaysFromURL.length > 0) {
        relaysFromURL.forEach((relayURL: string) => {
            if (relayURL) {
                $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
            }
        });
    }

    // Define offers filter
    let offersFilter: NDKFilter<NDKKind.FreelanceOffer> = {
        kinds: [NDKKind.FreelanceOffer],
        '#a': [jobAddress],
    };

    // ======================
    // 5. Effect Handlers
    // ======================
    // Handle adding people from offers
    $effect(() => {
        if (myJob && $offerStore) {
            $offerStore.forEach((offer) => {
                if ($wot?.size > 1 && $wot.has(offer.pubkey)) {
                    addPerson(offer.pubkey);
                }
            });
        }
    });

    // Handle adding people from messages
    $effect(() => {
        if ($wot?.size > 2) {
            wotFilteredMessages.forEach((message) => {
                const peer = peerFromMessage(message);
                if (peer && $wot.has(peer)) addPerson(peer);
            });
        }
    });

    // Handle scrolling when messages change
    $effect(() => {
        if (orderedMessages.length && elemChat) {
            setTimeout(() => scrollChatBottom('smooth'), 0);
        }
    });

    // Initial setup effect
    $effect(() => {
        if (!$currentUser || !job || initialized) return;

        initialized = true;

        // START MESSAGE STORE SUB
        const messageFilters = createMessageFilters();
        jobMessages = $ndk.storeSubscribe(messageFilters, getSubscriptionOptions());

        if ($currentUser.pubkey !== job.pubkey) {
            initializeAsNonOwner();
        } else {
            initializeAsOwner();
        }
    });

    // UI state effects
    $effect(() => {
        if (browser) {
            if (contactsOpen) {
                onContactListExpanded();
            } else {
                onContactListCollapsed();
            }
        }
    });

    // ======================
    // 6. Helper Functions
    // ======================

    function createMessageFilters(): NDKFilter<NDKKind.EncryptedDirectMessage>[] {
        return [
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                '#p': [$currentUser!.pubkey],
                '#t': [jobAddress],
                limit: 50_000,
            },
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                authors: [$currentUser!.pubkey],
                '#t': [jobAddress],
                limit: 50_000,
            },
        ];
    }

    function getSubscriptionOptions() {
        return {
            autoStart: true,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: false,
            groupable: false,
        };
    }

    // Invoke this function when it's not user's job
    function initializeAsNonOwner() {
        addPerson(job!.pubkey);
        const contact = people.find((c) => c.person.pubkey === job!.pubkey);
        if (contact) selectCurrentPerson(contact);
    }

    function initializeAsOwner() {
        myJob = true;
        handleWinningOffer();
        handlePreselectedContacts();
    }

    function handleWinningOffer() {
        if (job!.acceptedOfferAddress) {
            $ndk.fetchEvent(job!.acceptedOfferAddress).then((offer) => {
                if (offer) winner = offer.pubkey;
            });
        }
    }

    function handlePreselectedContacts() {
        if ($offerMakerToSelect) {
            handleOfferMakerSelection();
        } else if ($selectedPerson?.split('$')[1] === jobAddress) {
            handleSavedSelection();
        }
    }

    function handleOfferMakerSelection() {
        addPerson($offerMakerToSelect);
        const contact = people.find((c) => c.person.pubkey === $offerMakerToSelect);
        if (contact) selectCurrentPerson(contact);
        $offerMakerToSelect = '';
    }

    function handleSavedSelection() {
        const pubkey = $selectedPerson.split('$')[0];
        addPerson(pubkey);
        const contact = people.find((c) => c.person.pubkey === pubkey);
        if (contact) selectCurrentPerson(contact);
    }

    // ======================
    // 7. Core Functions
    // ======================
    // Message Functions
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

    // Contact Management
    async function addPerson(pubkey: string) {
        if (people.some((c) => c.person.pubkey === pubkey)) return;

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
        }
    }

    // UI Helpers
    function scrollChatBottom(behavior?: ScrollBehavior): void {
        elemChat?.scrollTo({ top: elemChat.scrollHeight, behavior });
    }

    function isFirstMessageOfDay(messages: NDKEvent[], index: number): boolean {
        if (index === 0) return true;

        const currentMessage = messages[index];
        const previousMessage = messages[index - 1];

        // Check if messages exist and have created_at timestamps
        if (!currentMessage?.created_at || !previousMessage?.created_at) {
            return false;
        }

        const currentDate = new Date(currentMessage.created_at * 1000);
        const previousDate = new Date(previousMessage.created_at * 1000);

        return currentDate.toDateString() !== previousDate.toDateString();
    }

    function onContactListExpanded() {
        // console.log('expandContacts')
        hideChat = true;
        disablePrompt = true;
        hideSearchIcon = true;
    }

    function onContactListCollapsed() {
        hideChat = false;
        disablePrompt = false;
        hideSearchIcon = false;
    }

    function peerFromMessage(message: NDKEvent): string | undefined {
        const peerPubkey =
            message.tagValue('p') === $currentUser!.pubkey ? message.pubkey : message.tagValue('p');

        return peerPubkey;
    }

    onMount(async () => {
        elemPage = document.querySelector('#page') as HTMLElement;
        onContactListExpanded();

        const jobEvent = await $ndk.fetchEvent(
            jobAddress,
            // Try to fetch latest state of the job
            // but fall back to cache
            { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL }
        );

        if (jobEvent) {
            job = TicketEvent.from(jobEvent);
            jobTitle = job.title.length < 21 ? job.title : job.title.substring(0, 20) + '...';

            offerStore = $ndk.storeSubscribe<OfferEvent>(
                offersFilter,
                { closeOnEose: false, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
                OfferEvent
            );
        }
    });

    onDestroy(() => {
        if (jobMessages) jobMessages.unsubscribe();
        if (offerStore) offerStore.unsubscribe();
    });
</script>

{#if $currentUser && job}
    <div class="w-full flex flex-col gap-0 grow h-full">
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
                        class="w-full h-full flex flex-col md:flex-row gap-[6px] grow overflow-hidden"
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
                            <div class="flex flex-col gap-[10px] overflow-y-auto grow">
                                {#each people as contact, i (contact.person.pubkey)}
                                    <Button
                                        variant={contact.selected ? 'contained' : 'text'}
                                        on:click={() => selectCurrentPerson(contact)}
                                    >
                                        <Avatar
                                            src={contact.person.profile?.picture ??
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
                                        {#snippet lead()}
                                            {#if currentPerson}
                                                <a href={'/' + currentPerson.npub}>
                                                    <Avatar
                                                        src={currentPerson.profile?.picture ??
                                                            getRoboHashPicture(
                                                                currentPerson.pubkey
                                                            )}
                                                        width="w-8"
                                                    />
                                                </a>
                                            {/if}
                                        {/snippet}
                                        {#snippet summary()}
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
                                        {/snippet}
                                        {#snippet content()}
                                            <!-- Absolutely positioned content -->
                                            <div
                                                class="absolute top-[70px] left-0 right-0 overflow-hidden z-100"
                                            >
                                                <div
                                                    class="flex flex-col items-center p-2 pb-0 space-x-2"
                                                >
                                                    <Card
                                                        classes="overflow-y-auto border-[2px] border-black-100 dark:border-white-100 h-[200px]"
                                                    >
                                                        {#each people as contact, i}
                                                            <button
                                                                type="button"
                                                                class="btn w-full flex items-center space-x-4
                                                                    {contact.selected
                                                                    ? 'variant-filled-primary'
                                                                    : 'bg-surface-hover-token'}"
                                                                onclick={() =>
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
                                        {/snippet}
                                    </AccordionItem>
                                </Accordion>
                            </Card>
                        </div>

                        <!-- Conversation -->
                        <Card classes="flex-2 h-full overflow-hidden flex flex-col ">
                            <div
                                bind:this={elemChat}
                                class="flex flex-col grow gap-[5px] overflow-y-auto p-[5px]"
                                style="height: {chatHeight}px;"
                            >
                                {#if $currentUser}
                                    {#each orderedMessages as message, index (message.id)}
                                        <MessageCard
                                            avatarRight={message.pubkey !== $currentUser.pubkey}
                                            {message}
                                            {searchTerms}
                                            isFirstOfDay={isFirstMessageOfDay(
                                                orderedMessages,
                                                index
                                            )}
                                        />
                                    {/each}
                                {:else}
                                    <div class="p-4 space-y-4">
                                        <div class="placeholder animate-pulse"></div>
                                        <div class="grid grid-cols-3 gap-8">
                                            <div class="placeholder animate-pulse"></div>
                                            <div class="placeholder animate-pulse"></div>
                                            <div class="placeholder animate-pulse"></div>
                                        </div>
                                        <div class="grid grid-cols-4 gap-4">
                                            <div class="placeholder animate-pulse"></div>
                                            <div class="placeholder animate-pulse"></div>
                                            <div class="placeholder animate-pulse"></div>
                                            <div class="placeholder animate-pulse"></div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </Card>
                    </div>

                    <!-- Input Wrapper -->
                    <div bind:this={elemInput}>
                        <Card classes="p-1">
                            <div
                                class="w-full h-full input-group input-group-divider grid-cols-[1fr_auto] rounded-container-token"
                            >
                                <textarea
                                    bind:value={currentMessage}
                                    class="bg-transparent border-0 ring-0 text-sm"
                                    name="prompt"
                                    id="prompt"
                                    placeholder="DON'T TYPE SECRETS HERE"
                                    rows="1"
                                    onkeydown={onPromptKeyDown}
                                    disabled={disablePrompt}
                                ></textarea>
                                <button
                                    class={currentMessage
                                        ? 'variant-filled-primary'
                                        : 'input-group-shim'}
                                    onclick={sendMessage}
                                >
                                    <i class="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div class="w-full h-[100vh] p-4 space-y-4 flex flex-col items-center">
        <div class="card w-full h-32 pt-4">
            <div class="w-full placeholder animate-pulse"></div>
        </div>
        <div class="card w-full h-32 pt-4">
            <div class="w-full placeholder animate-pulse"></div>
        </div>
        <div class="card w-full h-[70vh] pt-4">
            <div class="w-full placeholder animate-pulse"></div>
        </div>
    </div>
{/if}
