<script lang="ts">
    import ChatHead from "$lib/components/User/ChatHead.svelte";
    import { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import ndk from "$lib/stores/ndk";
    import currentUser, { loggedIn } from "$lib/stores/user";
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from "@nostr-dev-kit/ndk";
    import { Tab, TabGroup } from "@skeletonlabs/skeleton";
    import { onMount } from "svelte";

    enum ConversationType {
        Troubleshooter = 0,
        Client = 1
    }

    let troubleshooters: NDKUser[] = [];
    let ticketsWithTroubleshooters: TicketEvent[] = [];
    let clients: NDKUser[] = [];
    let ticketsWithClients: TicketEvent[] = [];
    let conversationType: ConversationType = ConversationType.Troubleshooter;
    let mounted = false;
    let noTicketsWithTroubleshooters = false;
    let noTicketsWithClients = false;

    $: if ($loggedIn && mounted) {
        init();
    }

    async function init() {
        console.log('init')
        const tickets = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.TroubleshootTicket],
                authors: [$currentUser!.pubkey],
            },
            {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
            },
        );

        console.log('my tickets in messages page:', tickets)

        if (tickets.size === 0) noTicketsWithTroubleshooters = true;

        tickets.forEach((ticketEvent: NDKEvent) => {
            const ticket = TicketEvent.from(ticketEvent);
            if (ticket.acceptedOfferAddress) {
                const pubkey = ticket.acceptedOfferAddress.split(':')[1];
                if (pubkey) {
                    const user = $ndk.getUser({pubkey: pubkey});
                    troubleshooters.push(user);
                    ticketsWithTroubleshooters.push(ticket);
                }
            }
        });

        troubleshooters = troubleshooters;
        ticketsWithTroubleshooters = ticketsWithTroubleshooters;

        const offers = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.TroubleshootOffer],
                authors: [$currentUser!.pubkey],
            },
            {
                groupable: true,
                groupableDelay: 400,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
            },
        );

        if (offers.size === 0) noTicketsWithClients = true;

        console.log('my offers in messages page:', offers)

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
                kinds: [NDKKind.TroubleshootTicket],
                '#d': ticketsToFetch,
            },
            {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
            }
        );
        console.log('tickets of offers in message page', ticketEvents)
        ticketEvents.forEach((t: NDKEvent) => {
            const ticket = TicketEvent.from(t);
            offers.forEach((o: NDKEvent) => {
                const offer = OfferEvent.from(o);
                if (ticket.acceptedOfferAddress === offer.offerAddress) {
                    const user = $ndk.getUser({pubkey: ticket.pubkey});
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
        const elemPage:HTMLElement = document.querySelector('#page') as HTMLElement;
        elemPage.scrollTo({ top: elemPage.scrollHeight*(-1), behavior:'instant' });
        
        mounted = true;
    });

</script>

{#if $currentUser}
    <TabGroup justify='justify-evenly' flex='flex-grow'>
        <Tab bind:group={conversationType} name="tab1" value={ConversationType.Troubleshooter}>
            Conversations with Troubleshooters
        </Tab>
        <Tab bind:group={conversationType} name="tab2" value={ConversationType.Client}>
            Conversations with Clients
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            <div class="grid grid-cols-[10%_1fr_10%] sm:grid-cols-[30%_1fr_30%] gap-y-4">
                {#if conversationType === ConversationType.Troubleshooter}
                    {#if troubleshooters?.length > 0}
                        {#each troubleshooters as troubleshooter, i}
                            <div class="col-start-2">
                                <ChatHead 
                                    user={troubleshooter}
                                    ticket={ticketsWithTroubleshooters[i]}
                                >
                                </ChatHead>
                            </div>
                        {/each}
                    {:else if noTicketsWithTroubleshooters}
                        <div class="h4 text-center col-start-2">No Conversations!</div>
                    {:else}
                        {#each {length: 4} as _ }
                            <section class="w-[300px] md:w-[400px] col-start-2">
                                <div class="p-4 space-y-4">
                                    <div class="grid grid-cols-[20%_1fr] gap-8 items-center">
                                        <div class="placeholder-circle animate-pulse" />
                                        <div class="placeholder animate-pulse" />
                                    </div>
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
                        {/each}
                    {/if}
                {:else if conversationType === ConversationType.Client}
                    {#if clients.length > 0}
                        {#each clients as client, i}
                            <div class="col-start-2">
                                <ChatHead 
                                    user={client}
                                    ticket={ticketsWithClients[i]}
                                >
                                </ChatHead>
                            </div>
                        {/each}
                    {:else if noTicketsWithClients}
                        <div class="h4 text-center col-start-2">No Conversations!</div>
                    {:else}
                        {#each {length: 4} as _ }
                            <section class="w-[300px] md:w-[400px] col-start-2">
                                <div class="p-4 space-y-4">
                                    <div class="grid grid-cols-[20%_1fr] gap-8 items-center">
                                        <div class="placeholder-circle animate-pulse" />
                                        <div class="placeholder animate-pulse" />
                                    </div>
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
                        {/each}
                    {/if}
                {/if}
        </svelte:fragment>
    </TabGroup>
{:else}
    <div class="h3 sm:h2 text-center mt-8">
        Log in to View your Conversations!
    </div>
{/if}
