<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { type NDKUserProfile } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';

    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    interface Props {
        notification: TicketEvent;
    }

    let { notification }: Props = $props();

    let statusString = $derived(getJobStatusString(notification.status));
    let statusColor = $derived(getJobStatusColor(notification.status));

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.picture) {
                userImage = userProfile.picture;
            }
        }
    });
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
    actAsButton
    onClick={() => {
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col items-start">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            {#if notification.status === TicketStatus.New}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <p>Has posted a new job:</p>

                    <a
                        href={'/' + notification.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        "{notification.title}"
                    </a>
                </div>
            {:else}
                <div class="flex flex-col gap-[5px]">
                    <div class="flex flex-row gap-[5px] flex-wrap">
                        <p>Has changed the status of job:</p>

                        <a
                            href={'/' + notification.encode() + '/'}
                            class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            "{notification.title}"
                        </a>
                    </div>
                    <p title="Job Status" class={statusColor}>
                        Job Status: {statusString}
                    </p>
                </div>
            {/if}
        </div>
    </div>
</Card>
