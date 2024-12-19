<script lang="ts">
    import type { NDKSubscriptionOptions, NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { Avatar } from '@nostr-dev-kit/ndk-svelte-components';
    import ndk from '$lib/stores/ndk';

    export let pubkey: string | undefined = undefined;
    export let npub: string | undefined = undefined;
    export let user: NDKUser | undefined = undefined;
    export let userProfile: NDKUserProfile | undefined = undefined;
    export let subOpts: NDKSubscriptionOptions | undefined = undefined;
    export let size: 'tiny' | 'small' | 'medium' | 'large' | undefined = undefined;
    export let type: 'square' | 'circle' = 'circle';
    export let ring = false;
    /**
     * Flag when the fetching is being done in a higher component
     **/
    export let fetching: boolean | undefined = undefined;

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

    if (fetching === undefined && !userProfile) {
        fetching = true;
        user ??= $ndk.getUser({ npub, pubkey });
        user?.fetchProfile(subOpts)
            .then((p) => {
                if (p) userProfile = p;
            })
            .catch((err) => {
                console.error(
                    'An error occurred in fetching user profile in avatar component',
                    err
                );
            })
            .finally(() => {
                fetching = false;
            });
    }

    let randSeed = Math.floor(Math.random() * 10) + 1;
</script>

{#if !userProfile && fetching}
    <img
        alt="Avatar loading..."
        src="https://robohash.org/{user?.pubkey ?? pubkey ?? randSeed}"
        class="
            {$$props.class}
            {$$props.loadingClass ? $$props.loadingClass : ''}
            {sizeClass} {shapeClass}
        "
        style={$$props.loadingStyle ?? ''}
    />
{:else if userProfile || user || pubkey || npub}
    <div
        class="
        flex-none {sizeClass} {shapeClass}
        {ring ? 'ring-4 ring-accent p-0.5' : ''}
    "
    >
        <Avatar
            ndk={$ndk}
            {pubkey}
            {npub}
            {user}
            {userProfile}
            class="flex-none object-cover {shapeClass} {sizeClass} {$$props.class ?? ''}"
        />
    </div>
{/if}
