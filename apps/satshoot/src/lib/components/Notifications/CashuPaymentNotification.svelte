<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import ndk from '$lib/stores/session';
    import {
        NDKKind,
        NDKNutzap,
        type NDKEvent,
        type NDKFilter,
        type NDKUserProfile
    } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import { JobEvent } from '$lib/events/JobEvent';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Card from '../UI/Card.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    import Avatar from '../Users/Avatar.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import { wallet } from '$lib/wallet/wallet';
    import { CheckStateEnum } from '@cashu/cashu-ts';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    const nutzap = nutzapFromEvent(notification);

    const zappee = nutzap?.recipient;
    let zappeeProfile = $state<NDKUserProfile | null>();
    let zappeeName = $derived(zappeeProfile?.name ?? zappee?.npub.substring(0, 8));

    const amount = nutzap.amount ?? 0;

    let zappedBid: BidEvent | null = $state(null);
    let zappedOrder: OrderEvent | null = $state(null);
    let job: JobEvent | null = $state(null);
    let service: ServiceEvent | null = $state(null);

    let locktime: number = $state(Number.POSITIVE_INFINITY);
    let claimableByUser = $state(false);
    let currentSeconds = $state(Number.NEGATIVE_INFINITY);

    function nutzapFromEvent(notification: NDKEvent): NDKNutzap {
        if (notification.kind === NDKKind.Nutzap) {
            const nutzap = NDKNutzap.from(notification);
            if (nutzap) return nutzap;
        }
        throw new Error("Invalid argument, notification event isn't an NDKNutzap!");
    }

    onMount(async () => {
        // Initialize the p2pk property
        await $wallet?.getP2pk();

        // Event
        let dTag: string | undefined;
        let zappedKind: number = -1;

        const atag = nutzap.tagValue('a');
        if (atag) {
            dTag = atag.split(':')[2];
            zappedKind = parseInt(atag.split(':')[0]);
        }

        if (zappedKind && dTag) {
            const filter: NDKFilter = {
                kinds: [zappedKind],
                '#d': [dTag],
            };
            if (zappedKind === ExtendedNDKKind.FreelanceBid) {
                const event = await $ndk.fetchEvent(filter);
                if (event) {
                    zappedBid = BidEvent.from(event);
                    const jobDtag = zappedBid.referencedJobDTag;
                    if (jobDtag) {
                        const jobEvent = await $ndk.fetchEvent({
                            kinds: [ExtendedNDKKind.FreelanceJob],
                            '#d': [jobDtag],
                        });
                        if (jobEvent) {
                            job = JobEvent.from(jobEvent);
                        }
                    }
                }
            } else if (zappedKind === ExtendedNDKKind.FreelanceOrder) {
                const event = await $ndk.fetchEvent(filter);
                if (event) {
                    zappedOrder = OrderEvent.from(event);
                    const serviceDtag = zappedOrder.referencedServiceDTag;
                    if (serviceDtag) {
                        const serviceEvent = await $ndk.fetchEvent({
                            kinds: [ExtendedNDKKind.FreelanceService],
                            '#d': [serviceDtag],
                        });
                        if (serviceEvent) {
                            service = ServiceEvent.from(serviceEvent);
                        }
                    }
                }
            }
        }
    });

    $effect(async () => {
        currentSeconds = Math.floor(Date.now() / 1000);

        // Initialize state for claiming proofs
        const proof = nutzap.proofs.length ? nutzap.proofs[0] : undefined;
        if (proof && proof.secret.startsWith('[')) {
            const secret = JSON.parse(proof.secret);
            if (Array.isArray(secret) && secret.length === 2 && secret[0] === "P2PK") {
                const secretObj = secret[1];
                if ("tags" in secretObj) {
                    for (const tag of secretObj.tags) {
                        if (tag[0] === "locktime") {
                            locktime = Number.parseInt(tag[1]);
                        }
                        if (tag[0] === "refund") {
                            const refundKey = (tag[1] as string).slice(2);
                            const pubkey = $wallet?._p2pk;
                            if (refundKey === pubkey) {
                                const cashuWallet = await $wallet?.getCashuWallet(nutzap.mint, $wallet.bip39seed)!;
                                const proofStates = await cashuWallet.checkProofsStates(nutzap.proofs);
                                claimableByUser = proofStates.filter(ps => {
                                    if (ps.state === CheckStateEnum.UNSPENT) {
                                        console.log("=> Nutzap: " + nutzap.id);
                                        console.log(`locktime: ${locktime}`);
                                        console.log("Current Time in Seconds: " + currentSeconds);
                                    }
                                    return ps.state === CheckStateEnum.UNSPENT
                                }).length > 0;
                            }
                        }
                    }
                }
            }
        }
    });

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: zappee.npub,
                    name: zappeeName,
                    job: job?.title,
                },
            ];

            const fuse = new Fuse(dataToSearch, {
                isCaseSensitive: false,
                ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
                threshold: 0.6,
                minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
                keys: [
                    {
                        name: 'npub',
                        weight: 0.3,
                    },
                    {
                        name: 'name',
                        weight: 0.3,
                    },
                    {
                        name: 'job',
                        weight: 0.4,
                    },
                ],
            });
            const searchResult = fuse.search(searchQuery);
            return searchResult.length > 0;
        }

        return true;
    });

    const classes = $derived.by(() => {
        let classes = $readNotifications.has(nutzap.id) ? 'bg-black-50' : 'font-bold';
        if (!display) {
            classes += ' hidden';
        }

        return classes;
    });

    async function onClaimNutzap() {
        const privateKey = $wallet?.privkeys.get($wallet._p2pk!)?.privateKey;
        if (!privateKey) {
            console.error("Invalid wallet state: get find private key!");
            return;
        }
        await $wallet?.redeemNutzaps([nutzap], privateKey, { mint: nutzap.mint, proofs: nutzap.proofs });
        // TODO (rodant): Show a notification to  the user.
        console.log("nutzap redeemed!");
    }
</script>

<Card
    {classes}
    actAsButton
    onClick={() => {
        if (!$readNotifications.has(nutzap.id)) {
            readNotifications.update((notifications) => notifications.add(nutzap.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={nutzap} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + zappee.npub} class="shrink-0">
            <Avatar pubkey={zappee.pubkey} bind:userProfile={zappeeProfile}/>
        </a>
        <div class="flex-1 min-w-0 flex flex-col">
            <p class="truncate max-w-full">{zappeeName}</p>
            <div class="flex flex-row gap-[5px] flex-wrap w-full">
                <p>
                    You nutzapped {(amount ? insertThousandSeparator(amount) : '?') + ' sats'}
                </p>
                {#if job}
                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] link break-words"
                    >
                        for the Job: "{job.title}"
                    </a>
                {:else if service}
                    <a
                        href={'/' + service.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] link break-words"
                    >
                        for the Service: "{service.title}"
                    </a>
                {:else}
                    <div class="w-32 placeholder animate-pulse bg-blue-600"></div>
                {/if}
            </div>
        </div>
        {#if claimableByUser}
            <Button variant="text" classes="p-[5px] text-white hover:bg-blue-600" disabled={!(locktime && locktime < currentSeconds)} onClick={onClaimNutzap}>
                <i class="bx bx-clock bx-sm"></i>
                Claim eCash
            </Button>
        {/if}
    </div>
</Card>
