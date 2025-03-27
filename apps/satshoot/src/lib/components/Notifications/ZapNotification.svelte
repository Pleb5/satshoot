<script lang="ts">
    import { run } from 'svelte/legacy';

    import { OfferEvent } from '$lib/events/OfferEvent';
    import ndk from '$lib/stores/ndk';
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

    import { TicketEvent } from '$lib/events/TicketEvent';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    interface Props {
        notification: NDKEvent;
    }

    let { notification }: Props = $props();

    const zapInvoice: NDKZapInvoice | null = zapInvoiceFromEvent(notification);

    const zapper =
        notification.kind === NDKKind.Zap
            ? $ndk.getUser({ pubkey: notification.tagValue('P') })
            : $ndk.getUser({ pubkey: notification.pubkey });

    let zapperName = $state(zapper.npub.substring(0, 8));
    let zapperImage = $state(getRoboHashPicture(zapper.pubkey));

    let amount: number | null = $state(null);

    let zappedOffer: OfferEvent | null = $state(null);
    let job: TicketEvent | null = $state(null);

    $effect(() => {
        if (zappedOffer) {
            const dTagOfJob = zappedOffer.referencedTicketAddress.split(':')[2];
            const jobFilter: NDKFilter<NDKKind.FreelanceTicket> = {
                kinds: [NDKKind.FreelanceTicket],
                '#d': [dTagOfJob],
            };

            $ndk.fetchEvent(jobFilter, {
                groupable: true,
                groupableDelay: 400,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
                .then((jobEvent) => {
                    if (jobEvent) {
                        job = TicketEvent.from(jobEvent);
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
            if (zapperProfile.image) {
                zapperImage = zapperProfile.image;
            }
        }

        if (zapInvoice) {
            // LN zap
            if (zapInvoice.zappedEvent) {
                const offerEvent = await $ndk.fetchEvent(zapInvoice.zappedEvent, {
                    groupable: true,
                    groupableDelay: 1000,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                });

                if (offerEvent) {
                    zappedOffer = OfferEvent.from(offerEvent);
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
            const zappedOfferID = notification.tagValue('e');
            if (zappedOfferID) {
                const offerEvent = await $ndk.fetchEvent(zappedOfferID, {
                    groupable: true,
                    groupableDelay: 1000,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                });
                if (offerEvent) {
                    zappedOffer = OfferEvent.from(offerEvent);
                }
            }
        }
    });
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
    actAsButton
    on:click={() => {
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
            <a href={'/' + zapper.npub}>
                <p>{zapperName}</p>
            </a>
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
