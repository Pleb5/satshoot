<script lang="ts">
    import ChatHead from '$lib/components/ChatHead.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import { page } from '$app/stores';

    enum ConversationType {
        Freelancer = 0,
        Client = 1,
    }

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: searchTerms = searchQuery ? searchQuery.split(',') : [];

    let freelancers: NDKUser[] = [];
    let ticketsWithFreelancers: TicketEvent[] = [];
    let clients: NDKUser[] = [];
    let ticketsWithClients: TicketEvent[] = [];
    let conversationType: ConversationType = ConversationType.Freelancer;
    let mounted = false;
    let noTicketsWithFreelancers = false;
    let noTicketsWithClients = false;

    $: if ($loggedIn && mounted) {
        init();
    }

    async function init() {
        console.log('init');
        const tickets = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                authors: [$currentUser!.pubkey],
            },
            {
                groupable: true,
                groupableDelay: 500,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            }
        );

        console.log('my tickets in messages page:', tickets);

        if (tickets.size === 0) noTicketsWithFreelancers = true;

        tickets.forEach((ticketEvent: NDKEvent) => {
            const ticket = TicketEvent.from(ticketEvent);
            if (ticket.acceptedOfferAddress) {
                const pubkey = ticket.acceptedOfferAddress.split(':')[1];
                if (pubkey) {
                    const user = $ndk.getUser({ pubkey: pubkey });
                    freelancers.push(user);
                    ticketsWithFreelancers.push(ticket);
                }
            }
        });

        freelancers = freelancers;
        ticketsWithFreelancers = ticketsWithFreelancers;

        const offers = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOffer],
                authors: [$currentUser!.pubkey],
            },
            {
                groupable: true,
                groupableDelay: 500,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            }
        );

        if (offers.size === 0) noTicketsWithClients = true;

        console.log('my offers in messages page:', offers);

        // Batching tickets to fetch
        const ticketsToFetch: string[] = [];
        for (const offerEvent of offers) {
            const offer = OfferEvent.from(offerEvent);
            if (offer.referencedTicketDTag) {
                ticketsToFetch.push(offer.referencedTicketDTag);
            }
        }

        const ticketEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                '#d': ticketsToFetch,
            },
            {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            }
        );
        console.log('tickets of offers in message page', ticketEvents);
        ticketEvents.forEach((t: NDKEvent) => {
            const ticket = TicketEvent.from(t);
            offers.forEach((o: NDKEvent) => {
                const offer = OfferEvent.from(o);
                if (ticket.acceptedOfferAddress === offer.offerAddress) {
                    const user = $ndk.getUser({ pubkey: ticket.pubkey });
                    clients.push(user);
                    ticketsWithClients.push(ticket);
                }
            });
        });

        clients = clients;
        ticketsWithClients = ticketsWithClients;
    }

    onMount(() => {
        // Scroll to top as soon as ticket arrives
        const elemPage: HTMLElement = document.querySelector('#page') as HTMLElement;
        elemPage.scrollTo({ top: elemPage.scrollHeight * -1, behavior: 'instant' });

        mounted = true;

        checkRelayConnections();
    });

    const tabs = [
        {
            id: ConversationType.Freelancer,
            label: 'Freelancer',
        },
        { id: ConversationType.Client, label: 'Client' },
    ];
</script>

{#if $currentUser}
    <div class="w-full flex flex-col gap-0 flex-grow">
        <div class="w-full h-full flex flex-col justify-center items-center py-[25px]">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[15px]">
                    <div
                        class="w-full h-full flex gap-[15px] max-h-[calc(100vh-160px)]"
                    >
                        <Card classes="gap-[10px]">
                            <TabSelector {tabs} bind:selectedTab={conversationType} />

                            <!-- Tab Content -->
                            <div class="w-full flex flex-col gap-[10px] p-[5px] overflow-y-auto">
                                {#if conversationType === ConversationType.Freelancer}
                                    {#if freelancers?.length > 0}
                                        {#each freelancers as freelancer, i}
                                            <ChatHead
                                                {searchTerms}
                                                user={freelancer}
                                                ticket={ticketsWithFreelancers[i]}
                                            />
                                        {/each}
                                    {:else if noTicketsWithFreelancers}
                                        <div class="h4 text-center col-start-2">
                                            No Conversations!
                                        </div>
                                    {:else}
                                        {#each { length: 6 } as _}
                                            <div class="w-full card flex gap-2 h-28 p-4">
                                                <div
                                                    class="w-20 placeholder-circle animate-pulse"
                                                />
                                                <div class="w-28 grid grid-rows-3 gap-2">
                                                    <div class="placeholder animate-pulse" />
                                                    <div class="placeholder animate-pulse" />
                                                    <div class="placeholder animate-pulse" />
                                                </div>
                                            </div>
                                        {/each}
                                    {/if}
                                {:else if clients.length > 0}
                                    {#each clients as client, i}
                                        <ChatHead
                                            {searchTerms}
                                            user={client}
                                            ticket={ticketsWithClients[i]}
                                        />
                                    {/each}
                                {:else if noTicketsWithClients}
                                    <div class="h4 text-center col-start-2">No Conversations!</div>
                                {:else}
                                    {#each { length: 6 } as _}
                                        <div class="w-full card flex gap-2 h-28 p-4">
                                            <div
                                                class="w-20 placeholder-circle animate-pulse"
                                            />
                                            <div class="w-28 grid grid-rows-3 gap-2">
                                                <div class="placeholder animate-pulse" />
                                                <div class="placeholder animate-pulse" />
                                                <div class="placeholder animate-pulse" />
                                            </div>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div class="h3 sm:h2 text-center mt-8">Log in to View your Conversations!</div>
{/if}
