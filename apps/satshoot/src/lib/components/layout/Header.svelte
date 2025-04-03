<script lang="ts">
    import {
        Avatar,
        getDrawerStore,
        getModalStore,
        type DrawerSettings,
        type ModalComponent,
        type ModalSettings,
    } from '@skeletonlabs/skeleton';
    import LoginModal from '../Modals/LoginModal.svelte';
    import currentUser, { loggedIn, loggingIn, loginMethod } from '$lib/stores/user';
    import Button from '../UI/Buttons/Button.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import { createEventDispatcher } from 'svelte';
    import drawerID, { DrawerIDs } from '$lib/stores/drawer';
    import { NDKKind, NDKRelaySet, profileFromEvent } from '@nostr-dev-kit/ndk';
    import ndk, { BOOTSTRAPOUTBOXRELAYS, DEFAULTRELAYURLS } from '$lib/stores/ndk';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const dispatch = createEventDispatcher();

    const drawerStore = getDrawerStore();
    const modalStore = getModalStore();

    let profilePicture = $state('');

    $effect(() => {
        if ($currentUser) fetchUserProfile();
    });

    const fetchUserProfile = async () => {
        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [$currentUser!.pubkey],
        };

        const metadataRelays = [...BOOTSTRAPOUTBOXRELAYS, ...DEFAULTRELAYURLS];

        const profileEvent = await fetchEventFromRelaysFirst(metadataFilter, {
            relayTimeoutMS: 3000,
            fallbackToCache: true,
            explicitRelays: Array.from(NDKRelaySet.fromRelayUrls(metadataRelays, $ndk).relays),
        });

        if (profileEvent) {
            const profile = profileFromEvent(profileEvent);
            $currentUser!.profile = profile;
            profilePicture =
                profile?.picture ?? profile?.image ?? getRoboHashPicture($currentUser!.pubkey);
        } else {
            profilePicture = getRoboHashPicture($currentUser!.pubkey);
        }
    };

    function handleLogin() {
        const modalComponent: ModalComponent = {
            ref: LoginModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    function openAppMenu() {
        $drawerID = DrawerIDs.AppMenu;
        const drawerSettings: DrawerSettings = {
            id: $drawerID.toString(),
            width: 'w-[50vw] sm:w-[40vw] md:w-[30vw]',
            position: 'right',
            bgDrawer: 'bg-surface-300-600-token',
        };
        drawerStore.open(drawerSettings);
    }

    const satShootLogoWrapperClass = 'flex flex-row items-center gap-4 ' + '';

    const satShootLogoClass =
        'flex flex-row justify-start items-center relative gap-4 text-[20px] ' +
        'text-blue-600 font-[800] hover:text-blue-500 hover:no-underline ' +
        'transition ease-in-out duration-[0.3s] w-full ';
</script>

<div class="w-full flex flex-col justify-center items-center gap-0 bg-white dark:bg-brightGray">
    <div class="flex flex-col justify-center items-center w-full">
        <div
            class="w-full flex flex-col items-center border-b border-b-black-100 py-1 dark:border-b-white-100"
        >
            <div
                class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full flex flex-row gap-6">
                    <div class={satShootLogoWrapperClass}>
                        <a href="/" class={satShootLogoClass}>
                            <img
                                src="/img/satshoot.svg"
                                alt="Satshoot logo"
                                class="w-full max-w-[45px]"
                            />
                            <p class="max-[576px]:hidden">SatShoot</p>
                        </a>
                    </div>
                    <div class="flex flex-row grow gap-4 justify-end items-center">
                        {#if $loggedIn}
                            <Button href="/post-job/">Submit Job</Button>
                            <button onclick={openAppMenu}>
                                <!-- Avatar image -->
                                <Avatar
                                    class="rounded-full border-white placeholder-white"
                                    border="border-4 border-surface-300-600-token hover:border-primary-500!"
                                    cursor="cursor-pointer"
                                    width="w-12 sm:w-14"
                                    src={profilePicture ??
                                        getRoboHashPicture($currentUser?.pubkey ?? '')}
                                />
                            </button>
                        {:else if $loggingIn}
                            <div class="flex items-center gap-x-2">
                                <h3 class="h6 md:h3 font-bold">Logging in...</h3>
                                <ProgressRing color="primary" size={12} />
                            </div>
                        {:else if $loginMethod === 'local'}
                            <Button on:click={() => dispatch('restoreLogin')}>Login</Button>
                        {:else}
                            <Button on:click={handleLogin}>Login</Button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
