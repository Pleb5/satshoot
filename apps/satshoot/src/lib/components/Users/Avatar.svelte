<script lang="ts">
    import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import ndk from '$lib/stores/session';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    interface Props {
        pubkey: string | undefined;
        userProfile?: NDKUserProfile | null;
        size?: 'tiny' | 'small' | 'medium' | 'large' | undefined;
        type?: 'square' | 'circle';
        ring?: boolean;
        classes?: string;
    }

    let {
        pubkey,
        userProfile = $bindable(),
        size = undefined,
        type = 'circle',
        ring = false,
        classes = '',
    }: Props = $props();

    let user = $state<NDKUser>();
    let sizeClass = $state('');
    let shapeClass = $state('');
    switch (size) {
        case 'tiny':
            sizeClass = 'w-6 h-6';
            break;
        case 'small':
            sizeClass = 'w-8 h-8';
            break;
        case 'medium':
            sizeClass = 'w-14 h-14';
            break;
        case 'large':
            sizeClass = 'w-16 h-16';
            break;
        default:
            sizeClass = 'w-14 h-14';
    }

    switch (type) {
        case 'circle':
            shapeClass = 'rounded-full';
            break;
        case 'square':
            shapeClass = 'rounded-sm';
            break;
    }

    // Fetch user profile reactively
    $effect(() => {
        if (!userProfile && pubkey) {
            user = $ndk.getUser({pubkey})
            user.fetchProfile({
                closeOnEose: true,
                groupable: true,
                groupableDelay: 800,
            })
                .then((profile) => {
                    if (profile) {
                        userProfile = profile;
                    }
                })
                .catch(() => {});
        }
    });

    const baseClasses = "rounded-full border-white placeholder-white cursor-pointer border-4 border-surface-300-600 hover:border-primary-500!"

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
            src={userProfile?.picture || getRoboHashPicture(user.pubkey)}
            class="object-cover {baseClasses} {sizeClass} {shapeClass} {classes}"
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
