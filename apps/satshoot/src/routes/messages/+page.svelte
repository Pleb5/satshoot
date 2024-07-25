<script lang="ts">
    import ChatHead from "$lib/components/User/ChatHead.svelte";
    import { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/user";
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from "@nostr-dev-kit/ndk";
    import { Tab, TabGroup } from "@skeletonlabs/skeleton";

    enum ConversationType {
        Troubleshooter = 0,
        Client = 1
    }

    let troubleshooters: NDKUser[] = [];
    let ticketsWithTroubleshooters: TicketEvent[] = [];
    let clients: NDKUser[] = [];
    let ticketsWithClients: TicketEvent[] = [];
    let conversationType: ConversationType = ConversationType.Troubleshooter;
    let initialized = false;

    $: if ($currentUser && !initialized) {
        init();
    }

    async function init() {
        initialized = true;
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
        console.log('my offers in messages page:', offers)

        for (const offerEvent of offers) {
            const offer = OfferEvent.from(offerEvent);
            const ticketEvent = await $ndk.fetchEvent(
                offer.referencedTicketAddress,
                {
                    groupable: true,
                    groupableDelay: 800,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
                }
            );
            if (ticketEvent) {
                const ticket = TicketEvent.from(ticketEvent);
                if (ticket.acceptedOfferAddress === offer.offerAddress) {
                    const user = $ndk.getUser({pubkey: ticket.pubkey});
                    clients.push(user);
                    ticketsWithClients.push(ticket);
                }
            }
        }

        troubleshooters = troubleshooters;
        clients = clients;
    }

</script>

{#if currentUser}
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
                    {#if troubleshooters.length > 0}
                        {#each troubleshooters as troubleshooter, i}
                            <div class="col-start-2">
                                <ChatHead 
                                    user={troubleshooter}
                                    ticket={ticketsWithTroubleshooters[i]}
                                >
                                </ChatHead>
                            </div>
                        {/each}
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
                    {#if troubleshooters.length > 0}
                        {#each clients as client, i}
                            <div class="col-start-2">
                                <ChatHead 
                                    user={client}
                                    ticket={ticketsWithClients[i]}
                                >
                                </ChatHead>
                            </div>
                        {/each}
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
    <div class="h3 sm:h2 text-center">
        Log in to View your Conversations!
    </div>
{/if}
