<script lang="ts">
    import { page } from '$app/stores';
    import JobCard from '$lib/components/Cards/JobCard.svelte';
    import NewOfferCard from '$lib/components/Cards/NewOfferCard.svelte';
    import NewUserCard from '$lib/components/Cards/NewUserCard.svelte';
    import NewCreateOfferModal from '$lib/components/Modals/NewCreateOfferModal.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk, { connected } from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import {
        NDKRelay,
        type NDKFilter,
        NDKKind,
        NDKSubscription,
        type NDKSubscriptionOptions,
        NDKUser,
    } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import {
        getModalStore,
        getToastStore,
        type ModalComponent,
        type ModalSettings,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { onDestroy, onMount } from 'svelte';

    enum OfferTab {
        Pending,
        Won,
        Lost,
    }

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    const subOptions: NDKSubscriptionOptions = {
        closeOnEose: false,
    };
    let jobSubscription: NDKSubscription | undefined = undefined;
    let jobPost: TicketEvent | undefined = undefined;
    let user: NDKUser | undefined = undefined;

    let offersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOffer],
        '#a': [],
    };
    let offerStore: NDKEventStore<ExtendedBaseType<OfferEvent>>;
    let alreadySubscribedToOffers = false;

    let offerToEdit: OfferEvent | undefined = undefined;
    let btnActionText = 'Create Offer';

    let allowCreateOffer: boolean = true;
    let disallowCreateOfferReason = '';

    let offersTab = OfferTab.Pending;

    let myJob = false;
    $: if ($currentUser && jobPost) {
        if ($currentUser && $currentUser.pubkey === jobPost.pubkey) {
            myJob = true;
        }
    }

    let needSetup = true;
    // Wait for ndk to connect then setup subscription on ticket from URL params
    // Also check for existing ndk because we try to add relays from the naddr here
    $: if ($ndk && $connected && needSetup) {
        needSetup = false;
        const naddr = $page.params.jobId;
        const relaysFromURL = relaysFromNaddr(naddr).split(',');
        // console.log('ticket relays', relaysFromURL)
        if (relaysFromURL.length > 0) {
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    // url, authopolicy and ndk. authopolicy is not important yet
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });
        }

        // Create new subscription on this ticket
        const dTag = idFromNaddr(naddr).split(':')[2];
        const ticketFilter: NDKFilter = {
            kinds: [NDKKind.FreelanceTicket],
            '#d': [dTag],
        };

        jobSubscription = $ndk.subscribe(ticketFilter, subOptions);
        jobSubscription.on('event', (event) => {
            console.log('event :>> ', event);
            // Dismiss with old tickets
            if (jobPost) {
                const arrivedTicket = TicketEvent.from(event);
                if (arrivedTicket.created_at! < jobPost.created_at!) {
                    return;
                }
            }
            jobPost = TicketEvent.from(event);
            user = $ndk.getUser({ pubkey: jobPost.pubkey });

            // Scroll to top as soon as ticket arrives
            const elemPage: HTMLElement = document.querySelector('#page') as HTMLElement;
            elemPage.scrollTo({ top: elemPage.scrollHeight * -1, behavior: 'instant' });

            // TODO: Some effect to show the ticket changed

            if (jobPost.status !== TicketStatus.New) {
                allowCreateOffer = false;
                disallowCreateOfferReason =
                    "Status of this ticket not 'New' anymore! Cannot Create/Edit Offer!";
            }

            // Subscribe on Offers of this ticket. Do this only once
            if (!alreadySubscribedToOffers) {
                alreadySubscribedToOffers = true;
                // Add a live sub on offers of this ticket if not already subbed
                // Else already subbed, we can check if new offer arrived on ticket
                offersFilter['#a']!.push(jobPost.ticketAddress);
                offerStore = $ndk.storeSubscribe<OfferEvent>(offersFilter, subOptions, OfferEvent);
            }
        });
    }

    $: if ($offerStore) {
        // Filtering out offers not in the web of Trust
        if ($wot && $wot.size > 2) {
            $offerStore = $offerStore.filter((offer: OfferEvent) => {
                return $wot.has(offer.pubkey);
            });
        }

        orderEventsChronologically($offerStore);

        $offerStore.forEach((offer: OfferEvent) => {
            if (offer.pubkey === $currentUser?.pubkey) {
                offerToEdit = offer;
                btnActionText = 'Edit Your Offer';
            }
        });
    }

    let pendingOffers: OfferEvent[] = [];
    let winningOffer: OfferEvent | undefined = undefined;
    let lostOffers: OfferEvent[] = [];

    $: if (jobPost && $offerStore) {
        if (jobPost.status !== TicketStatus.New) {
            winningOffer = undefined;
            pendingOffers = [];

            if (jobPost.acceptedOfferAddress) {
                winningOffer = $offerStore.find(
                    (offer) => offer.offerAddress === jobPost?.acceptedOfferAddress
                );

                offersTab = OfferTab.Won;
            }

            lostOffers = $offerStore.filter(
                (offer) => offer.offerAddress !== jobPost?.acceptedOfferAddress
            );
        } else {
            pendingOffers = $offerStore;
            winningOffer = undefined;
            lostOffers = [];
        }
    }

    onMount(() => checkRelayConnections());

    onDestroy(() => {
        jobSubscription?.stop();
        if (offerStore) {
            offerStore.unsubscribe();
        }
    });

    async function createOffer(offer: OfferEvent | undefined) {
        if (!jobPost) {
            const t: ToastSettings = {
                message: 'Ticket is not loaded yet!',
                autohide: false,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
            return;
        }
        const offerPosted: boolean = await new Promise<boolean>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: NewCreateOfferModal,
                props: {
                    ticket: jobPost,
                    offerToEdit: offer,
                },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (offerPosted: boolean) => {
                    resolve(offerPosted);
                },
            };
            modalStore.trigger(modal);
        });
    }

    const offerBtnClasses =
        'transition ease duration-[0.3s] outline outline-[1px] outline-[rgb(0,0,0,0.1)] py-[6px] px-[12px] ' +
        'rounded-[6px] transform whitespace-nowrap flex flex-row justify-center items-center gap-[8px] font-[600] ' +
        'text-[rgb(255,255,255,0.5)] bg-[rgb(59,115,246)] hover:bg-[#3b82f6] hover:text-white max-[768px]:grow-[1]';

    const tabSelectorClasses =
        'w-full flex flex-row flex-wrap p-[5px] gap-[10px] rounded-[6px] bg-[rgb(0,0,0,0.1)] border-[2px] border-[rgb(0,0,0,0.05)]';

    const tabSelectorItemClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] rounded-[4px] text-center font-[600] cursor-pointer';

    const selectedTabClasses = 'text-white bg-[rgb(59,115,246)]';
    const nonSelectedTabClasses =
        'hover:text-[rgb(255,255,255,0.65)] hover:bg-[rgb(59,115,246,0.5)] text-[rgb(0,0,0,0.35)]';
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full flex flex-col justify-center items-center py-[25px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                {#if jobPost}
                    <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                        <!-- Job post main start -->
                        <div class="w-full flex flex-col gap-[15px]">
                            <JobCard job={jobPost} />

                            {#if !myJob}
                                <div class="w-full flex flex-col gap-[15px]">
                                    <div
                                        class="w-full flex flex-row flex-wrap gap-[10px] justify-between items-center"
                                    >
                                        <p
                                            class="font-[600] text-[24px] flex flex-row gap-[5px] items-center"
                                        >
                                            My Submission
                                        </p>
                                    </div>

                                    {#if offerToEdit}
                                        <NewOfferCard offer={offerToEdit} />
                                    {/if}

                                    {#if allowCreateOffer}
                                        <div class="flex flex-row justify-center">
                                            <button
                                                type="button"
                                                on:click={() => createOffer(offerToEdit)}
                                                class={offerBtnClasses}
                                            >
                                                {btnActionText}
                                            </button>
                                        </div>
                                    {:else}
                                        <div
                                            class="w-full min-h-[100px] rounded-[8px] bg-[rgb(0,0,0,0.1)] border-[4px] border-[rgb(0,0,0,0.1)] flex flex-col justify-center items-center"
                                        >
                                            <p
                                                class="font-[600] text-[18px] text-[rgb(0,0,0,0.35)]"
                                            >
                                                {disallowCreateOfferReason}
                                            </p>
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                            <div class="w-full flex flex-col gap-[15px]">
                                <div
                                    class="w-full flex flex-row flex-wrap gap-[10px] justify-between items-center"
                                >
                                    <p
                                        class="font-[600] text-[24px] flex flex-row gap-[5px] items-center"
                                    >
                                        Offers
                                        <span class="font-[400] text-[16px]"
                                            >({insertThousandSeparator($offerStore.length)})</span
                                        >
                                    </p>
                                </div>

                                <!-- tabs start-->
                                <div class="w-full flex flex-col gap-[10px]">
                                    <!-- tabs selector start-->
                                    <div class={tabSelectorClasses}>
                                        <button
                                            on:click={() => (offersTab = OfferTab.Pending)}
                                            class="{tabSelectorItemClasses} {offersTab ===
                                            OfferTab.Pending
                                                ? selectedTabClasses
                                                : nonSelectedTabClasses}"
                                        >
                                            Pending
                                        </button>
                                        <button
                                            on:click={() => (offersTab = OfferTab.Won)}
                                            class="{tabSelectorItemClasses} {offersTab ===
                                            OfferTab.Won
                                                ? selectedTabClasses
                                                : nonSelectedTabClasses}"
                                        >
                                            Won
                                        </button>
                                        <button
                                            on:click={() => (offersTab = OfferTab.Lost)}
                                            class="{tabSelectorItemClasses} {offersTab ===
                                            OfferTab.Lost
                                                ? selectedTabClasses
                                                : nonSelectedTabClasses}"
                                        >
                                            Lost
                                        </button>
                                    </div>
                                    <!-- tabs selector end-->
                                    <!-- tabs content start-->
                                    <div class="w-full flex flex-col">
                                        {#if offersTab === OfferTab.Pending}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Offer post start-->
                                                    {#each pendingOffers as offer}
                                                        <NewOfferCard {offer} />
                                                    {/each}
                                                </div>
                                            </div>
                                        {:else if offersTab === OfferTab.Won}
                                            {#if winningOffer}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        <NewOfferCard offer={winningOffer} />
                                                    </div>
                                                </div>
                                            {/if}
                                        {:else}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Offer post start-->
                                                    {#each lostOffers as offer}
                                                        <NewOfferCard {offer} />
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                    <!-- tabs content end -->
                                </div>
                                <!-- tabs end-->
                            </div>
                        </div>
                        <!-- user card -->
                        {#if user}
                            <NewUserCard {user} job={jobPost} />
                        {/if}
                    </div>
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
        </div>
    </div>
</div>
