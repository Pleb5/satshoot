<script lang="ts">
    import { page } from '$app/state';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import { onDestroy, onMount } from 'svelte';
    import { Accordion } from '@skeletonlabs/skeleton-svelte';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import {
        NDKEvent,
        NDKKind,
        NDKRelay,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
        type NDKSigner,
        type NDKUser,
    } from '@nostr-dev-kit/ndk';
    import MessageCard from '$lib/components/Cards/MessageCard.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { checkRelayConnections, getRoboHashPicture, orderEventsChronologically } from '$lib/utils/helpers';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import { toaster } from '$lib/stores/toaster';
    import { browser } from '$app/environment';

    interface Contact {
        person: NDKUser;
        selected: boolean;
    }

    const searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    const searchTerms = $derived(searchQuery ? searchQuery.split(',') : []);
    const jobAddress = idFromNaddr(page.params.jobId);
    const relaysFromURL = relaysFromNaddr(page.params.jobId).split(',');
    let titleLink = '/' + page.params.jobId;
    let job = $state<TicketEvent | null>(null);
    let jobTitle = $derived.by(() => {
        if (!job || !job.title) return 'Job: ?'

        return job.title.length < 21 
            ? job.title 
            : job.title.substring(0, 20) + '...';
        
    });
    let myJob = $state(false);
    let initialized = $state(false);

    let currentPerson = $state<NDKUser>();
    let currentMessage = $state('');
    let winner = $state('');
    let contactsOpen = $state(false);
    let disablePrompt = $state<boolean>();
    let hideChat = $state(false);
    let hideSearchIcon = $state(false);
    let accordionState = $derived([(currentPerson?.pubkey ?? '')]);
    let mounted = $state(false);

    // DOM Elements
    let elemPage = $state<HTMLElement>();
    let elemChat = $state<HTMLElement>();
    let elemHeader = $state<HTMLElement>();
    let elemInput = $state<HTMLElement>();
    let elemContactsMobileView = $state<HTMLElement>();

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

    const messageSubOptions: NDKSubscribeOptions = {
        autoStart: false,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        closeOnEose: false,
        groupable: false,
    };

    const messageFilters:NDKFilter[] = [
        {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#t': [jobAddress],
            limit: 50,
        },
        {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#t': [jobAddress],
            limit: 50,
        },
    ];

    const jobMessages = $ndk.storeSubscribe(messageFilters, messageSubOptions);

    const wotFilteredMessages = $derived.by(() => {
        if (!$currentUser || !$jobMessages?.length) return [];
        return $jobMessages.filter((message) => {
            const peer = peerFromMessage(message);
            return peer && $wot.has(peer);
        });
    });

    // Contact List
    let people = $derived.by(() => {
        const contactList: Contact[] = [];

        if (job && $currentUser) {
            if($currentUser?.pubkey !== job?.pubkey) {
                addPerson(job.pubkey, contactList)
            } else if ($offerMakerToSelect) {
                addPerson($offerMakerToSelect, contactList)
            } else if ($selectedPerson?.split('$')[1] === jobAddress) {
                const pubkey = $selectedPerson.split('$')[0];
                addPerson(pubkey, contactList)
            }
        }

        if (myJob) {
            $offerStore.forEach((offer) => {
                if ($wot.has(offer.pubkey)) {
                    addPerson(offer.pubkey, contactList);
                }
            });
        }

        wotFilteredMessages.forEach((message) => {
            const peer = peerFromMessage(message);
            if (peer && $wot.has(peer)) addPerson(peer, contactList);
        });

        return contactList;
    });

    async function addPerson(pubkey: string, people: Contact[]) {
        if (people.some((c) => c.person.pubkey === pubkey)) return;

        // We havent added this person yet
        const person = $ndk.getUser({ pubkey: pubkey });
        // console.log('adding new person', person)
        const contact = { person: person, selected: false };

        people.push(contact);

        await person.fetchProfile();
    }

    const offersSubOptions: NDKSubscribeOptions = {
        autoStart: false,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        closeOnEose: false,
    };

    let offersFilter: NDKFilter<NDKKind.FreelanceOffer> = {
        kinds: [NDKKind.FreelanceOffer],
        '#a': [jobAddress],
    };

    let offerStore = $ndk.storeSubscribe<OfferEvent>(
        offersFilter,
        offersSubOptions,
        OfferEvent
    ); 

    // Initial setup effect
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;

            // Add relays from URL
            if (relaysFromURL.length > 0) {
                relaysFromURL.forEach((relayURL: string) => {
                    if (relayURL) {
                        $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                    }
                });
            }

            checkRelayConnections();

            init();
        }
    });

    const init = async () => {
        const jobEvent = await $ndk.fetchEvent(
            jobAddress,
            // Try to fetch latest state of the job
            // but fall back to cache
            { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL }
        );

        if (jobEvent) {
            job = TicketEvent.from(jobEvent);

            messageFilters[0]['#p'] = [$currentUser!.pubkey],
            messageFilters[1].authors = [$currentUser!.pubkey],

            jobMessages.startSubscription();
            offerStore.startSubscription();

            if ($currentUser!.pubkey !== job.pubkey) {
                initializeAsNonOwner();
            } else {
                initializeAsOwner();
            }
        } else {
            console.warn('Job could not be fetched in chat page!')
        }
    };

    function initializeAsNonOwner() {
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
            const contact = people.find((c) => c.person.pubkey === $offerMakerToSelect);
            if (contact) selectCurrentPerson(contact);
        } else if ($selectedPerson?.split('$')[1] === jobAddress) {
            const pubkey = $selectedPerson.split('$')[0];
            const contact = people.find((c) => c.person.pubkey === pubkey);
            if (contact) selectCurrentPerson(contact);
        }
    }

    $effect.root(() => {
        let previousLength = 0;

        $effect(() => {
            const currentLength = orderedMessages.length;

            if (currentLength > previousLength && currentLength > 0 && mounted) {
                setTimeout(() => scrollChatBottom('smooth'), 0);
            }

            previousLength = currentLength;
        });
    });

    async function sendMessage() {
        if (currentMessage) {
            if (!currentPerson) {
                toaster.error({
                    title: 'No Person to message!',
                });

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

    function selectCurrentPerson(contact: Contact) {
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

            contactsOpen = false;
        }
    }

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

    $effect(() => {
        if (browser) {
            if (contactsOpen) {
                onContactListExpanded();
            } else {
                onContactListCollapsed();
            }
        }
    });

    function peerFromMessage(message: NDKEvent): string | undefined {
        const peerPubkey =
            message.tagValue('p') === $currentUser!.pubkey ? message.pubkey : message.tagValue('p');

        return peerPubkey;
    }

    onMount(async () => {
        elemPage = document.querySelector('#page') as HTMLElement;
        mounted = true;
    });

    onDestroy(() => {
        if (jobMessages) jobMessages.unsubscribe();
        if (offerStore) offerStore.unsubscribe();
        $offerMakerToSelect = '';
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
                                {'Job: ' + jobTitle}
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
                                        onClick={() => selectCurrentPerson(contact)}
                                    >
                                        <Avatar
                                            src={contact.person.profile?.picture ??
                                                getRoboHashPicture(contact.person.pubkey)}
                                            classes="size-8"
                                            name={contact.person.profile?.name ??
                                                contact.person.npub.substring(0, 10)}
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
                                    value={accordionState}
                                    onValueChange={(e) => (accordionState = e.value)}
                                    collapsible
                                    classes="flex flex-col items-center bg-transparent relative"
                                >
                                    <Accordion.Item value="contacts">
                                        {#snippet lead()}
                                            {#if currentPerson}
                                                <a href={'/' + currentPerson.npub}>
                                                    <Avatar
                                                        src={currentPerson.profile?.picture ??
                                                            getRoboHashPicture(
                                                                currentPerson.pubkey
                                                            )}
                                                        classes="size-8"
                                                        name={currentPerson.profile?.name ??
                                                            currentPerson.npub.substring(0, 15)}
                                                    />
                                                </a>
                                            {/if}
                                        {/snippet}
                                        {#snippet control()}
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
                                        {#snippet panel()}
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
                                                                    ? 'preset-filled-primary'
                                                                    : 'bg-surface-hover'}"
                                                                onclick={() =>
                                                                    selectCurrentPerson(contact)}
                                                            >
                                                                <Avatar
                                                                    src={contact.person.profile
                                                                        ?.image ??
                                                                        getRoboHashPicture(
                                                                            contact.person.pubkey
                                                                        )}
                                                                    classes="size-8"
                                                                    name={contact.person.profile
                                                                        ?.name ??
                                                                        contact.person.npub.substring(
                                                                            0,
                                                                            15
                                                                        )}
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
                                    </Accordion.Item>
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
                                class="w-full h-full input-group input-group-divider grid-cols-[1fr_auto] rounded-container"
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
                                    class= {
                                        currentMessage
                                            ? 'preset-filled-primary'
                                            : 'input-group-shim'
                                        + ' p-2'
                                    }
                                    onclick={sendMessage}
                                    aria-label="send message"
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
