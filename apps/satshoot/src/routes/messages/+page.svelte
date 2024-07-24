<script lang="ts">
    import ChatHead from "$lib/components/User/ChatHead.svelte";
    import { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketEvent } from "$lib/events/TicketEvent";
    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/user";
    import { NDKEvent, NDKKind, type NDKUser } from "@nostr-dev-kit/ndk";

    let troubleshooters: NDKUser[] = [];
    let clients: NDKUser[] = [];
    let initialized = false;

    $: if ($currentUser) {
        if (!initialized) init();
    }

    async function init() {
        initialized = true;
        console.log('init')
        const tickets = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.TroubleshootTicket],
                authors: [$currentUser!.pubkey],
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
                }
            }
        });

        const offers = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.TroubleshootOffer],
                authors: [$currentUser!.pubkey],
            },
        );
        console.log('my offers in messages page:', offers)

        for (const offerEvent of offers) {
            const offer = OfferEvent.from(offerEvent);
            const ticketEvent = await $ndk.fetchEvent(offer.referencedTicketAddress);
            if (ticketEvent) {
                const ticket = TicketEvent.from(ticketEvent);
                if (ticket.acceptedOfferAddress === offer.offerAddress) {
                    const user = $ndk.getUser({pubkey: offer.pubkey});
                    clients.push(user);
                }
            }
        }

        troubleshooters = troubleshooters;
        clients = clients;
    }

</script>

{#if currentUser}
    <div class="h3 sm:h2 text-center">
        Your Troubleshooters
    </div>
<div class="">
</div>
    {#if troubleshooters.length > 0}
        {#each troubleshooters as troubleshooter}
            <ChatHead user={troubleshooter}>
                <div class="opacity-50">
                    {'latest message'}
                </div>
            </ChatHead>
        {/each}
    {:else}
        {#each {length: 4} as _ }
            <section class="w-[300px] md:w-[400px]">
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

    <div class="h3 sm:h2 text-center">
        Your Clients
    </div>

{:else}
    <div class="h3 sm:h2 text-center">
        Log in to View your Conversations!
    </div>
{/if}
