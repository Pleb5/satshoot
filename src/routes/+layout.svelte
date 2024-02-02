<script lang="ts">
    import "../app.css";

    // Font awesome
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
	import '@fortawesome/fontawesome-free/css/solid.css';
	import '@fortawesome/fontawesome-free/css/brands.css';

    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/currentUser";
    import { LoginMethod } from "$lib/stores/currentUser";


    import { privateKeyFromSeedWords} from "nostr-tools/nip06"
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

    import { AppShell } from '@skeletonlabs/skeleton';
    import { AppBar } from '@skeletonlabs/skeleton';
    import { Avatar } from '@skeletonlabs/skeleton';
    import { AppRail, AppRailAnchor, AppRailTile } from '@skeletonlabs/skeleton';
    import { TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';

    // Popup menu
    import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
    import { storePopup, popup, type PopupSettings } from '@skeletonlabs/skeleton';
    import SettingsMenu from "$lib/components/PopupMenu/SettingsMenu.svelte";

    // Menu Items 
    import MenuItem_1 from "$lib/components/NavBar/MenuItem_1.svelte";
    import MenuItem_2 from "$lib/components/NavBar/MenuItem_2.svelte";
    import MenuItem_3 from "$lib/components/NavBar/MenuItem_3.svelte";

    // Skeleton Toast
    import { Toast, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    // Skeleton Modals
    import { Modal, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import DecryptSeedModal from "$lib/components/Modals/DecryptSeedModal.svelte";

    // Skeleton stores init
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { onMount } from "svelte";

    initializeStores();

    // Skeleton popup init
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let profileImage: string | undefined;
    let loggedIn: boolean;

    $: {
        profileImage = $currentUser?.profile?.image;
        loggedIn = !!$currentUser;
    }
        
    onMount(async () => {
        if (!loggedIn) {
            // Try to get saved user from localStorage
            const loginMethod = localStorage.getItem("login-method");

            if (loginMethod){
                if (loginMethod === LoginMethod.Ephemeral) {
                    try {
                        // Get decrypted seed from a modal prompt where user enters passphrase
                        // User can dismiss modal in which case decryptedSeed is undefined
                        new Promise<string|undefined>((resolve) => {
                            const modalComponent: ModalComponent = {
                                ref: DecryptSeedModal,
                            };

                            const modal: ModalSettings = {
                                type: 'component',
                                component: modalComponent,
                                response: (decryptedSeed: string|undefined) => {
                                    resolve(decryptedSeed); 
                                },
                            };
                            // Call DecryptSeed Modal to prompt for passphrase
                            // This can throw invalid seed words if decryption was unsuccessful
                            modalStore.trigger(modal);
                            // We got some kind of response from modal
                        }).then(async (decryptedSeed: string|undefined) => {
                                if (decryptedSeed) {
                                    console.log("got seedwords from localStorage: ", decryptedSeed);
                                    const privateKey = privateKeyFromSeedWords(decryptedSeed); 
                                    $ndk.signer = new NDKPrivateKeySigner(privateKey); 

                                    // Set persistent currentUser
                                    let user: NDKUser = await $ndk.signer.user();
                                    currentUser.set(user);
                                    console.log('Current user set:', $currentUser)
                                    await $currentUser.fetchProfile();

                                    // Trigger UI change in profile when user Promise is retrieved
                                    $currentUser = $currentUser;
                                }
                            });

                    } catch(e) {
                        // Todo: Errors in Toast message without timeout
                        const t: ToastSettings = {
                            message:`Could not create private key from seed words, error: ${e}`,
                            autohide: false,
                        };
                        toastStore.trigger(t);
                    }
                } else if (loginMethod === LoginMethod.NIP07) {
                    $ndk.signer = new NDKNip07Signer();
                    let user:NDKUser = await $ndk.signer.user();

                    currentUser.set(user);
                    console.log('Current user set:', $currentUser)
                    await $currentUser.fetchProfile();

                    console.log('profile image:',$currentUser.profile.image)
                    // Trigger UI update for profile
                    $currentUser = $currentUser;
                }
            }
        } else {
            // We are logged in, lets fetch profile
            console.log('Logged in in layout.svelte')
            console.log($currentUser.ndk)
            await $currentUser.fetchProfile();
            $currentUser = $currentUser;
        }
    });


    const settingsMenu: PopupSettings = {
        event: "click",
        target: "settingsMenu",
        placement: "top"
    };


    
</script>

<Toast />
<Modal />
<AppShell slotSidebarLeft="bg-surface-100-800-token">
	<svelte:fragment slot="header">
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end ">
            <svelte:fragment slot="lead">
                <div class="flex items-center w-16 h-16">
                    <img class="w-full h-full" src="bitcoin-troubleshoot.svg" alt="logo" />
                </div>
            </svelte:fragment>
            
            <svelte:fragment slot="trail">
                {#if loggedIn}
                    <!-- Triggers popup settings menu -->
                    <button use:popup={settingsMenu}>

                        <!-- Avatar image -->
                        <Avatar 
                            class="rounded-full border-white placeholder-white"
                            border="border-4 border-surface-300-600-token hover:!border-primary-500"
                            cursor="cursor-pointer"
                            bind:src={profileImage}
                        /> 
                    </button>
                    <!-- Popup menu content -->
                    <SettingsMenu />
                {:else}
                    <a href="/login" class="btn btn-md bg-primary-300-600-token ">
                        <span>Login</span>
                    </a>

                {/if}
            </svelte:fragment>

            <div class="flex items-center space-x-4">
                <a href="/" class="btn-icon w-16 h-16">
                </a>
            </div>

        </AppBar>
    </svelte:fragment>
    <!-- Sidebar. Hidden on small screens -->
	<svelte:fragment slot="sidebarLeft">
            <AppRail 
                class="hidden lg:block"
                hover="hover:variant-soft-primary"
                active="bg-primary-300-600-token"
                background="bg-surface-100-800-token"
            >
                <svelte:fragment slot="lead">
                    <AppRailAnchor href="/" selected={$page.url.pathname === '/'}>
                        <MenuItem_1 />
                    </AppRailAnchor>

                    <AppRailAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
                        <MenuItem_2 />
                    </AppRailAnchor>

                    <AppRailAnchor href="/messages" selected={$page.url.pathname === '/messages'}>
                        <MenuItem_3 /> 
                    </AppRailAnchor>
                </svelte:fragment>
            </AppRail>
    </svelte:fragment>

	<!-- Router Slot -->
	<slot />

    <!-- Footer: Only visible on small and medium screens(sm, md) -->
	<svelte:fragment slot="footer">
        <TabGroup 
            justify="justify-center"
            active="bg-primary-300-600-token"
            hover="hover:variant-soft-primary"
            flex="flex-1"
            rounded=""
            border=""
            background="bg-surface-100-800-token"
            class="lg:hidden w-full"
        >
            <TabAnchor href="/" selected={$page.url.pathname === '/'}>
                    <MenuItem_1 />
            </TabAnchor>

            <TabAnchor href="/my-tickets" selected={$page.url.pathname === '/my-tickets'}>
                    <MenuItem_2 />
            </TabAnchor>

            <TabAnchor href="/messages" selected={$page.url.pathname === '/messages'}>
                    <MenuItem_3 />
            </TabAnchor>
            <!-- ... -->
        </TabGroup>
    </svelte:fragment>
</AppShell>

<!-- <AppHeader /> -->

