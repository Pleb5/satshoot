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

    export let job: TicketEvent;

    $: statusString = getJobStatusString(job.status);
    $: statusColor = getJobStatusColor(job.status);

    $: user = $ndk.getUser({ pubkey: job.pubkey });
    $: userName = user.npub.substring(0, 8);
    $: userImage = `https://robohash.org/${user.pubkey}`;

    let userProfile: NDKUserProfile | null;

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.image) {
                userImage = userProfile.image;
            }
        }
    });
</script>

<Card
    classes={$readNotifications.has(job.id) ? 'bg-[rgb(0,0,0,0.05)]' : ''}
    on:click={() => {
        readNotifications.update((notifications) => notifications.add(job.id));
    }}
>
    <NotificationTimestamp ndkEvent={job} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            {#if job.status === TicketStatus.New}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <p>Has posted a new job:</p>

                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] hover:text-blue-500"
                    >
                        "{job.title}"
                    </a>
                </div>
            {:else}
                <div class="flex flex-col gap-[5px]">
                    <div class="flex flex-row gap-[5px] flex-wrap">
                        <p>Has changed the status of job:</p>

                        <a
                            href={'/' + job.encode() + '/'}
                            class="transition ease duration-[0.3s] font-[600] hover:text-blue-500"
                        >
                            "{job.title}"
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
