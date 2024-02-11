<script lang="ts">
import ndk from '$lib/stores/ndk';
import { TabGroup, Tab } from '@skeletonlabs/skeleton';

import { OfferStatus, type OfferEvent } from '$lib/events/OfferEvent';
import { myOffers } from '$lib/stores/troubleshoot-eventstores';
import OfferCard from '../OrderBook/OfferCard.svelte';

let tabGroup = OfferStatus.Pending;

const offerMap: Map<OfferStatus, OfferEvent[]> = new Map();
let pendingOffersArray: OfferEvent[] = [];
let wonOffersArray: OfferEvent[] = [];
let lostOffersArray: OfferEvent[] = [];

offerMap.set(OfferStatus.Pending, pendingOffersArray);
offerMap.set(OfferStatus.Won, wonOffersArray);
offerMap.set(OfferStatus.Lost, lostOffersArray);

// Sort offers into buckets according to state. Do this every time a new offers is received for the user
$: {
    if ($myOffers) {
        $myOffers.forEach((offer: OfferEvent) => {
            let offerArray = offerMap.get(offer.status as OfferStatus) as OfferEvent[];
            if (!offerArray) {
                console.log('Impossible offer status: ', offer.status)
                return;
            }
            let found = false;
            offerArray.forEach((sortedOffer: OfferEvent) => {
                if (sortedOffer.offerAddress === offer.offerAddress) {
                    found = true;
                }
            });
            if (!found) {
                offerArray.push(offer);
                console.log('new unique offers, adding to myOffers...')
                pendingOffersArray = pendingOffersArray;
                wonOffersArray = wonOffersArray;
                lostOffersArray = lostOffersArray;
            }
            console.log('pendingOffersArray', pendingOffersArray)
        });


        console.log('my offers:', $myOffers)
        console.log('pending offers:', pendingOffersArray)
    } else {
        console.log('My offers is null!')
    }
}

</script>

{#if $ndk.activeUser}
    <TabGroup justify='justify-evenly' flex='flex-grow'>
        <Tab bind:group={tabGroup} name="tab1" value={OfferStatus.Pending}>
            Pending
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={OfferStatus.Won}>
            In Progress
        </Tab>
        <Tab bind:group={tabGroup} name="tab2" value={OfferStatus.Lost}>
            Lost
        </Tab>
        <!-- Tab Panels --->
        <svelte:fragment slot="panel">
            {#if tabGroup === 0}
                <div class="grid grid-cols-1 itesm-center center gap-y-4 mx-8">
                    {#each pendingOffersArray as offer }
                        <OfferCard {offer} />
                    {/each}
                </div>
            {:else if tabGroup === 1}
                <div>
                    {#each wonOffersArray as offer }
                        <OfferCard {offer} />
                    {/each}
                </div>
            {:else if tabGroup === 2}
                <div>
                    {#each lostOffersArray as offer }
                        <OfferCard {offer} />
                    {/each}
                </div>
            {/if}
        </svelte:fragment>
    </TabGroup>
    {:else}
    <h2 class="h2 text-center">Log in to view your Offers!</h2>
{/if}
