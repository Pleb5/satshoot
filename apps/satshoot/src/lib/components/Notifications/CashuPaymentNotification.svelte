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

    function nutzapFromEvent(notification: NDKEvent): NDKNutzap {
        if (notification.kind === NDKKind.Nutzap) {
            const nutzap = NDKNutzap.from(notification);
            if (nutzap) return nutzap;
        }
        throw new Error("Invalid argument, notification event isn't an NDKNutzap!");
    }

    onMount(async () => {
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
    </div>
</Card>
