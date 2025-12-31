<script lang="ts">
    import {
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import { shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import ReputationCard from '../Cards/ReputationCard.svelte';
    import Avatar from '$lib/components/Users/Avatar.svelte';

    interface Props {
        user: Hexpubkey;
    }

    let { user }: Props = $props();

    // Derived values
    const npub = $derived(nip19.npubEncode(user));
    const profileLink = $derived('/' + npub);

    // Reactive state
    let userProfile = $state<NDKUserProfile | null>(null);

</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[5px]">
        <div
            class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-black-100 dark:border-white-100 dark:border-r-white-100"
        >
            <a
                class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                href={profileLink}
            >
                <Avatar pubkey={user} bind:userProfile size={'medium'} classes={"shadow-strong"} />
            </a>
        </div>
        <div class="w-full flex flex-col gap-[5px]">
            <a href={profileLink} class="font-[600] line-clamp-1 overflow-hidden max-w-[200px]">
                {userProfile?.name ??
                    userProfile?.displayName ??
                    shortenTextWithEllipsesInMiddle(npub, 15)}
            </a>
            <ReputationCard {user} type={ReviewType.Client} />
        </div>
    </div>
</div>
