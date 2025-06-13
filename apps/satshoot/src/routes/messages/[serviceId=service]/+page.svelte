<script lang="ts">
    import { page } from '$app/state';
    import { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { onDestroy, onMount } from 'svelte';
    import { Accordion } from '@skeletonlabs/skeleton-svelte';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import { NDKEvent } from '@nostr-dev-kit/ndk';
    import MessageCard from '$lib/components/Cards/MessageCard.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import { browser } from '$app/environment';

    import SELECTED_QUERY_PARAM, {
        MessageService,
        ContactService,
        ServiceService,
        UIService,
    } from '$lib/services/messages';

    let initialized = $state(false);
    let initialContactsAdded = $state(false);

    // Parse URL parameters
    const searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    const serviceAddress = idFromNaddr(page.params.serviceId);
    const relaysFromURL = relaysFromNaddr(page.params.serviceId).split(',');
    const titleLink = '/' + page.params.serviceId;

    // Initialize services
    const messageService = $state(new MessageService(serviceAddress, page.params.serviceId));
    const contactService = $state(new ContactService());
    const serviceService = $state(new ServiceService(serviceAddress, relaysFromURL));
    const uiService = $state(new UIService());

    // DOM element references
    let headerElem = $state<HTMLElement>();
    let chatElem = $state<HTMLElement>();
    let inputElem = $state<HTMLElement>();
    let contactsMobileViewElem = $state<HTMLElement>();

    // Service state values
    const wotFilteredMessages = $derived(messageService.messages);
    const contacts = $derived(contactService.contacts);
    const currentContact = $derived(contactService.currentContact);
    const winnerPubkey = $derived(contactService.winnerPubkey);
    const service = $derived(serviceService.service);
    const myService = $derived(serviceService.isOwner);
    const orders = $derived(serviceService.orders);
    // UI state - direct access to service properties
    const disablePrompt = $derived(uiService.disablePrompt);
    const mounted = $derived(uiService.mounted);
    const chatHeight = $derived(uiService.chatHeight);

    // Message state
    let currentMessage = $state('');

    // Accordion state
    let accordionState = $derived([currentContact ?? '']);

    // Effect to update UI service with DOM elements
    $effect(() => {
        if (headerElem) uiService.setHeaderElement(headerElem);
        if (chatElem) uiService.setChatElement(chatElem);
        if (inputElem) uiService.setInputElement(inputElem);
    });

    // Current person messages
    const currentPersonMessages = $derived.by(() => {
        if (!currentContact || !wotFilteredMessages.length) return [];
        return messageService.getPersonMessages(currentContact.person, wotFilteredMessages);
    });

    // Ordered messages
    const orderedMessages = $derived.by(() => {
        return messageService.orderMessages(currentPersonMessages);
    });

    const serviceTitle = $derived.by(() => {
        if (!service || !service.title) return '?';

        return service.title.length < 21 ? service.title : service.title.substring(0, 20) + '...';
    });

    // Initialize when session is ready
    $effect(() => {
        if ($sessionInitialized && $currentUser && !initialized) {
            initialized = true;

            serviceService.initialize();

            // when user directly opens the chat with direct url
            // he will be presented with login modal
            // on login current user will be initialized and
            // this block will be executed but it possible that
            // wot is not loaded yet, so we may not see any messages
            // therefor, it's better to initialize the messages service with
            // some timeout which will allow the wot to be loaded

            setTimeout(() => {
                messageService.initialize($currentUser.pubkey);
            }, 10_000);
        }
    });

    $effect(() => {
        if (service && $currentUser && !initialContactsAdded) {
            initialContactsAdded = true;
            console.log('Adding initial contacts');
            const pubkeyToSelect = page.url.searchParams.get(SELECTED_QUERY_PARAM) ?? '';

            contactService.addInitialContacts(service.pubkey, $currentUser.pubkey, pubkeyToSelect);
        }
    });

    $effect(() => {
        if (myService && orders) {
            const orderPubkeys = orders.map((order: any) => order.pubkey);
            contactService.addPeopleFromPubkeys(orderPubkeys);
        }
    });

    $effect(() => {
        if (wotFilteredMessages && $currentUser) {
            wotFilteredMessages.forEach((message: any) => {
                contactService.addContactFromMessage(message, $currentUser.pubkey);
            });
        }
    });

    // Auto-scroll to bottom when new messages arrive
    $effect.root(() => {
        let previousLength = 0;

        $effect(() => {
            const currentLength = orderedMessages.length;

            if (currentLength > previousLength && currentLength > 0 && mounted) {
                setTimeout(() => uiService.scrollChatBottom('smooth'), 0);
            }

            previousLength = currentLength;
        });
    });

    // Handle keyboard events
    function onPromptKeyDown(event: KeyboardEvent) {
        if (currentMessage && ['Enter'].includes(event.code)) {
            event.preventDefault();
            sendMessage();
        }
    }

    // Send message
    async function sendMessage() {
        if (currentMessage && currentContact) {
            messageService.sendMessage(currentContact.person, currentMessage);
            currentMessage = '';
        }
    }

    // Select contact
    function selectCurrentContact(contact: any) {
        contactService.selectCurrentContact(contact);
        uiService.setContactsOpen(false);
    }

    // Check if first message of day
    function isFirstMessageOfDay(messages: NDKEvent[], index: number): boolean {
        return messageService.isFirstMessageOfDay(messages, index);
    }

    // Setup on mount
    onMount(() => {
        if (browser) {
            const pageElement = document.querySelector('#page') as HTMLElement;
            if (pageElement) uiService.setPageElement(pageElement);
        }
    });

    // Cleanup on destroy
    onDestroy(() => {
        messageService.unsubscribe();
        serviceService.unsubscribe();
    });

    // Function to navigate back
    function goBack() {
        window.history.back();
    }
</script>

{#if $currentUser && service}
    <div class="w-full flex flex-col gap-0 grow h-full">
        <div class="w-full h-full flex flex-col justify-center items-center pt-[15px]">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[10px] pb-1">
                    <!-- Title Card -->
                    <div bind:this={headerElem}>
                        <Card classes="flex-row">
                            <Button variant="outlined" onClick={goBack}>
                                <i class="bx bx-chevron-left"></i>
                            </Button>
                            <a
                                class="anchor font-[700] sm:text-[24px] text-center flex-grow"
                                href={titleLink}
                            >
                                {'Service: ' + serviceTitle}
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
                                {#each contacts as contact}
                                    {@const image =
                                        contact.profile?.image ??
                                        getRoboHashPicture(contact.person.pubkey)}
                                    {@const name =
                                        contact.profile?.name ??
                                        contact.person.npub.substring(0, 10)}
                                    <Button
                                        variant={contact.selected ? 'contained' : 'text'}
                                        onClick={() => selectCurrentContact(contact)}
                                    >
                                        <Avatar src={image} size="size-12" {name} />
                                        <span
                                            class="flex-1 text-start {contact.person.pubkey ===
                                            winnerPubkey
                                                ? 'text-warning-500 font-bold'
                                                : ''}"
                                        >
                                            {name}
                                        </span>
                                    </Button>
                                {/each}
                            </div>
                        </Card>

                        <!-- Contact List Dropdown (Mobile) -->
                        <div class="md:hidden w-full" bind:this={contactsMobileViewElem}>
                            <Card classes="p-[10px">
                                <Accordion
                                    value={accordionState}
                                    onValueChange={(e) => (accordionState = e.value)}
                                    collapsible
                                    classes="flex flex-col items-center bg-transparent relative"
                                >
                                    <Accordion.Item value="contacts">
                                        {#snippet lead()}
                                            {#if currentContact}
                                                {@const profileImage =
                                                    currentContact.profile?.image ??
                                                    getRoboHashPicture(
                                                        currentContact.person.pubkey
                                                    )}
                                                <a href={'/' + currentContact.person.npub}>
                                                    <Avatar
                                                        src={profileImage}
                                                        size="size-8"
                                                        name={currentContact.profile?.name ??
                                                            currentContact.person.npub.substring(
                                                                0,
                                                                15
                                                            )}
                                                    />
                                                </a>
                                            {/if}
                                        {/snippet}
                                        {#snippet control()}
                                            {#if currentContact}
                                                <span
                                                    class="flex-1 text-start
                                                        {currentContact.person.pubkey ===
                                                    winnerPubkey
                                                        ? 'text-warning-400 font-bold'
                                                        : ''}"
                                                >
                                                    {currentContact.profile?.name ??
                                                        currentContact.person.npub.substring(0, 15)}
                                                </span>
                                            {:else if contacts.length > 0}
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
                                                        {#each contacts as contact}
                                                            {@const profileImage =
                                                                contact.profile?.image ??
                                                                getRoboHashPicture(
                                                                    contact.person.pubkey
                                                                )}
                                                            <button
                                                                type="button"
                                                                class="btn w-full flex items-center space-x-4
                                                                    {contact.selected
                                                                    ? 'preset-filled-primary'
                                                                    : 'bg-surface-hover'}"
                                                                onclick={() =>
                                                                    selectCurrentContact(contact)}
                                                            >
                                                                <Avatar
                                                                    src={profileImage}
                                                                    size="size-8"
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
                                                                    winnerPubkey
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
                        <Card classes="flex-2 h-full overflow-hidden flex flex-col">
                            <div
                                bind:this={chatElem}
                                class="flex flex-col grow gap-[5px] overflow-y-auto p-[5px]"
                                style="height: {chatHeight}px;"
                            >
                                {#if $currentUser}
                                    {#each orderedMessages as message, index (message.id)}
                                        <MessageCard
                                            avatarRight={message.pubkey !== $currentUser.pubkey}
                                            {message}
                                            {searchQuery}
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
                    <div bind:this={inputElem}>
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
                                    class={currentMessage
                                        ? 'preset-filled-primary p-2'
                                        : 'input-group-shim p-2'}
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
