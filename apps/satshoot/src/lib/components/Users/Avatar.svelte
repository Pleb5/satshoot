<script lang="ts">
    import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import { wot } from '$lib/stores/wot';

    interface Props {
        pubkey: string | undefined;
        userProfile?: NDKUserProfile | null;
        showWoT?: boolean;
        trusted?: boolean;
        size?: 'tiny' | 'small' | 'medium' | 'large' | undefined;
        sizeClasses?: string;
        type?: 'square' | 'circle';
        classes?: string;
        showNameOnClick?: boolean;
    }

    let {
        pubkey,
        userProfile = $bindable(),
        showWoT = true,
        trusted = $bindable(),
        size = undefined,
        sizeClasses = '',
        type = 'circle',
        classes = '',
        showNameOnClick = false,
    }: Props = $props();

    let showName = $state(false);
    let avatarRef: HTMLDivElement | null = null;
    let lastFetchedPubkey = $state<string | undefined>(undefined);

    const sizeClass = $derived.by(() => {
        switch (size) {
            case 'tiny':
                return 'w-6 h-6';
            case 'small':
                return 'w-8 h-8';
            case 'medium':
                return 'w-14 h-14';
            case 'large':
                return 'w-18 h-18';
            default:
                return 'w-14 h-14';
        }
    });

    const shapeClass = $derived(type === 'square' ? 'rounded-sm' : 'rounded-full');
    const finalSizeClass = $derived(sizeClasses?.trim() ? sizeClasses : sizeClass);
    const displayName = $derived.by(() => {
        if (!pubkey) return '';
        return (
            userProfile?.name ||
            userProfile?.displayName ||
            shortenTextWithEllipsesInMiddle(pubkey, 12)
        );
    });

    let wotClasses = $state('border-white');

    $effect(() => {
        if (!pubkey) return;
        if (lastFetchedPubkey === pubkey) return;

        const user = $ndk.getUser({ pubkey });
        fetchUserProfile(user);
        lastFetchedPubkey = pubkey;
    });

    const fetchUserProfile = async (user: NDKUser) => {
        try {
            userProfile = await user.fetchProfile({
                closeOnEose: true,
                groupable: true,
                groupableDelay: 800,
            });
        } catch {}
    };

    $effect(() => {
        if ($sessionInitialized && pubkey) {
            if ($wot.has(pubkey)) {
                trusted = true;
                if (showWoT) {
                    wotClasses = 'border-yellow-500';
                }
            } else {
                trusted = false;
                if (showWoT) {
                    wotClasses = 'border-red-500';
                }
            }
        }
    });

    const baseClasses =
        'rounded-full placeholder-white cursor-pointer border-4 hover:border-primary-500!';

    function toggleName(event: MouseEvent) {
        if (!showNameOnClick) return;
        event.stopPropagation();
        showName = !showName;
    }

    function handleNameKeydown(event: KeyboardEvent) {
        if (!showNameOnClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showName = !showName;
        }
    }

    function handleClickOutside(event: PointerEvent) {
        if (!showNameOnClick || !showName) return;
        if (avatarRef && !avatarRef.contains(event.target as Node)) {
            showName = false;
        }
    }

    $effect(() => {
        if (!showNameOnClick || !showName) return;

        document.addEventListener('pointerdown', handleClickOutside, true);

        return () => {
            document.removeEventListener('pointerdown', handleClickOutside, true);
        };
    });

</script>

{#if pubkey}
    <div
        class="flex-none {finalSizeClass} {shapeClass} {showNameOnClick ? 'relative' : ''}"
        role={showNameOnClick ? 'button' : undefined}
        tabindex={showNameOnClick ? 0 : undefined}
        on:click={toggleName}
        on:keydown={handleNameKeydown}
        bind:this={avatarRef}
    >
        <img
            alt="user avatar"
            src={userProfile?.picture || getRoboHashPicture(pubkey)}
            class="object-cover {baseClasses} {finalSizeClass} {shapeClass} {wotClasses} {classes}"
        />
        {#if showNameOnClick && showName}
            <div
                class="absolute left-0 top-full mt-1 w-[160px] rounded-md bg-white px-2 py-1 text-[11px] text-black-500 shadow-subtle dark:bg-brightGray dark:text-white-100"
            >
                <span class="break-words text-left leading-tight">{displayName}</span>
            </div>
        {/if}
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
