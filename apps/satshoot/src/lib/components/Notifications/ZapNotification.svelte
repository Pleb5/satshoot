<script lang="ts">
    import { run } from 'svelte/legacy';

    import { BidEvent } from '$lib/events/BidEvent';
    import ndk from '$lib/stores/session';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
        type NDKEvent,
        type NDKFilter,
        type NDKUserProfile,
        type NDKZapInvoice,
    } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';

    import { JobEvent } from '$lib/events/JobEvent';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    const zapInvoice: NDKZapInvoice | null = zapInvoiceFromEvent(notification);

    const zapper =
        notification.kind === NDKKind.Zap
            ? $ndk.getUser({ pubkey: notification.tagValue('P') })
            : $ndk.getUser({ pubkey: notification.pubkey });

    let zapperName = $state(zapper.npub.substring(0, 8));
    let zapperImage = $state(getRoboHashPicture(zapper.pubkey));

    let amount: number | null = $state(null);

    let zappedBid: BidEvent | null = $state(null);
    let job: JobEvent | null = $state(null);

    $effect(() => {
        if (zappedBid) {
            const dTagOfJob = zappedBid.referencedJobAddress.split(':')[2];
            const jobFilter: NDKFilter<NDKKind.FreelanceJob> = {
                kinds: [NDKKind.FreelanceJob],
                '#d': [dTagOfJob],
            };

            $ndk.fetchEvent(jobFilter, {
                groupable: true,
                groupableDelay: 400,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
                .then((jobEvent) => {
                    if (jobEvent) {
                        job = JobEvent.from(jobEvent);
                    }
                })
                .catch(() => {});
        }
    });

    onMount(async () => {
        const zapperProfile = await zapper.fetchProfile();
        if (zapperProfile) {
            if (zapperProfile.name) {
                zapperName = zapperProfile.name;
            }
            if (zapperProfile.picture) {
                zapperImage = zapperProfile.picture;
            }
        }

        if (zapInvoice) {
            // LN zap
            if (zapInvoice.zappedEvent) {
                const bidEvent = await $ndk.fetchEvent(zapInvoice.zappedEvent, {
                    groupable: true,
                    groupableDelay: 1000,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                });

                if (bidEvent) {
                    zappedBid = BidEvent.from(bidEvent);
                }
            }

            if (zapInvoice.amount) {
                amount = Math.round(zapInvoice.amount / 1000);
            }
        } else if (notification.kind === NDKKind.Nutzap) {
            // Nutzap
            const nutZapAmount = notification.tagValue('amount');
            if (nutZapAmount) {
                amount = Math.round(parseInt(nutZapAmount) / 1000);
            }
            const zappedBidID = notification.tagValue('e');
            if (zappedBidID) {
                const bidEvent = await $ndk.fetchEvent(zappedBidID, {
                    groupable: true,
                    groupableDelay: 1000,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                });
                if (bidEvent) {
                    zappedBid = BidEvent.from(bidEvent);
                }
            }
        }
    });

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: zapper.npub,
                    name: zapperName,
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
        let classes = $readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold';
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
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + zapper.npub}>
            <ProfileImage src={zapperImage} />
        </a>
        <div class="flex flex-col">
            <p>{zapperName}</p>
            <div class="flex flex-row gap-[5px] flex-wrap">
                <p>
                    Has zapped you {(amount ? insertThousandSeparator(amount) : '?') + ' sats'}
                </p>
                {#if job}
                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        for the job: "{job.title}"
                    </a>
                {:else}
                    <div class="w-32 placeholder animate-pulse bg-blue-600"></div>
                {/if}
            </div>
        </div>
    </div>
</Card>
