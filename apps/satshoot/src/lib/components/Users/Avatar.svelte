<script lang="ts">
    import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { wot } from '$lib/stores/wot';

    interface Props {
        pubkey: string | undefined;
        userProfile?: NDKUserProfile | null;
        showWoT?: boolean;
        trusted?: boolean;
        size?: 'tiny' | 'small' | 'medium' | 'large' | undefined;
        type?: 'square' | 'circle';
        classes?: string;
    }

    let {
        pubkey,
        userProfile = $bindable(),
        showWoT = true,
        trusted = $bindable(),
        size = undefined,
        type = 'circle',
        classes = '',
    }: Props = $props();

    let sizeClass = $state('');
    let shapeClass = $state('');

    let wotClasses = $state('border-white')

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
            sizeClass = 'w-18 h-18';
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

    $effect(() => {
        if (!userProfile && pubkey) {
            const user = $ndk.getUser({pubkey})
            fetchUserProfile(user)
        }
    });

    const fetchUserProfile = async (user: NDKUser) => {
        try {
            userProfile = await user.fetchProfile({
                closeOnEose: true,
                groupable: true,
                groupableDelay: 800,
            })
        } catch {}
    }

    $effect(() => {
        if (sessionInitialized && pubkey) {
            if ($wot.has(pubkey)) {
                trusted = true
                if (showWoT) {
                    wotClasses = 'border-yellow-500'
                }
            } else {
                trusted = false
                if (showWoT) {
                    wotClasses = 'border-red-500'
                }
            }
        }
    })

    const baseClasses = "rounded-full placeholder-white cursor-pointer border-4 hover:border-primary-500!"

</script>

{#if pubkey}
    <div
        class="flex-none {sizeClass} {shapeClass}"
    >
        <img
            alt="user avatar"
            src={userProfile?.picture || getRoboHashPicture(pubkey)}
            class="object-cover {baseClasses} {sizeClass} {shapeClass} {wotClasses} {classes}"
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
