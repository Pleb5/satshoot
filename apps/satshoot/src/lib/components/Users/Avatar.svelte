<script lang="ts">
    import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import ndk from '$lib/stores/ndk';
    import { onMount } from 'svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    export let pubkey: string;
    export let userProfile: NDKUserProfile | undefined = undefined;
    export let size: 'tiny' | 'small' | 'medium' | 'large' | undefined = undefined;
    export let type: 'square' | 'circle' = 'circle';
    export let ring = false;

    let user: NDKUser;
    let sizeClass = '';
    let shapeClass = '';

    switch (size) {
        case 'tiny':
            sizeClass = 'w-6 h-6';
            break;
        case 'small':
            sizeClass = 'w-8 h-8';
            break;
        case 'medium':
            sizeClass = 'w-12 h-12';
            break;
        case 'large':
            sizeClass = 'w-16 h-16';
            break;
    }

    switch (type) {
        case 'circle':
            shapeClass = 'rounded-full';
            break;
        case 'square':
            shapeClass = 'rounded';
            break;
    }

    // Fetch user profile reactively
    $: if (!userProfile && user) {
        user.fetchProfile({
            closeOnEose: true,
            groupable: true,
            groupableDelay: 200,
        })
            .then((profile) => {
                if (profile) {
                    userProfile = profile;
                }
            })
            .catch(() => {});
    }

    onMount(() => {
        if (pubkey) {
            user = $ndk.getUser({ pubkey });
        }
    });
</script>

{#if user}
    <div
        class="
        flex-none {sizeClass} {shapeClass}
        {ring ? 'ring-4 ring-accent p-0.5' : ''}
    "
    >
        <img
            alt="user avatar"
            src={userProfile?.image || getRoboHashPicture(user.pubkey)}
            class="object-cover {sizeClass} {shapeClass}"
        />
    </div>
{:else}
    <img alt="" class="avatar avatar--loading" />
{/if}

<style lang="postcss">
    .avatar {
        background-color: #ccc;
    }

    .avatar--loading {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }
</style>
