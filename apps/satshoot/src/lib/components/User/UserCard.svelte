<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from '$lib/stores/user';
    import {
        NDKEvent, 
        NDKKind, 
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        type NDKUser,
        type NDKUserProfile
    } from "@nostr-dev-kit/ndk";

    import { wot } from '$lib/stores/wot';

    import { connected } from "$lib/stores/ndk";

    import EditProfileModal from "../Modals/EditProfileModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { Avatar } from "@skeletonlabs/skeleton";
    import { clipboard } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    export let npub: string | undefined = undefined;
    export let user: NDKUser | undefined = undefined;
    let userProfile:NDKUserProfile;

// Because of the two-way binding AND reactivity, we must ensure to run reactive profile fetch exactly ONCE
    let needProfile = true;

    let editable = false;
    let partOfWoT = false;
    let trustColor = 'text-error-500';
    let bgTrustColor = 'bg-error-500';

    $: if (npub || $currentUser) {
        // if user changed the npub reload profile
        needProfile = true;
    }

    // Some strange behavior around ndk, user and ndk.activeUser when recursively
    // assigning ndk.getUser(npub) -> user.ndk = this -> user.ndk.activeUser = ...?
    // user.ndk.activeUser.ndk = .... ???!!! infinte recursion of assignments?
    $: if (npub && needProfile && $connected) {
        console.log('setting user and profile')
        let opts = { npub: npub };
        try {
            // console.log('user is undefined, setting user')
            user = $ndk.getUser(opts);
            editable = $currentUser?.npub === npub;

            const profilePromise = user.fetchProfile(
                {cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY},
            );

            if ($currentUser && $wot.has(user.pubkey)) {
                partOfWoT = true;
                trustColor = 'text-tertiary-500';
                bgTrustColor = 'bg-tertiary-500';
            }

            profilePromise.then((profile:NDKUserProfile | null) => {
                if (profile) {
                    // console.log('profile promise arrived', profile)
                    needProfile = false;
                    // ndk bug here: profile is NOT saved in indexedDb as regualar
                    // event causing ndk to sometimes load profile in a weird way
                    userProfile = profile;
                }
            });
        } catch (e) {
            console.error(`error trying to get user`, { opts }, e);
        }
    }

    async function editProfile() {
        const event = new NDKEvent($ndk);
        event.kind = NDKKind.Metadata;
        event.content = JSON.stringify({
            // ! //
            name: userProfile.name,
            displayName: userProfile.name,
            // ! //
            about: userProfile.about,
            bio: userProfile.about,
            // ! //
            lud16: userProfile.lud16,

            picture: userProfile?.image,
            banner: userProfile?.banner,
            nip05: userProfile?.nip05,
            website: userProfile?.website,
        });
        if ($currentUser) {
            try {
                $currentUser.profile = userProfile;

                const blastrUrl = 'wss://nostr.mutinywallet.com';
                const broadCastRelaySet = NDKRelaySet.fromRelayUrls([
                    blastrUrl,
                    ...$ndk.pool.urls(),
                    ...$ndk.outboxPool!.urls()
                ], $ndk);
                console.log('relays sent to:', broadCastRelaySet)
                const relaysPublished = await event.publish(broadCastRelaySet);
                console.log('relaysPublished', relaysPublished)

                const t: ToastSettings = {
                    message:`Profile changed!`,
                };
                toastStore.trigger(t);

            } catch(e) {
                const t: ToastSettings = {
                    message:`Profile update failed! Reason: ${e}`,
                };
                toastStore.trigger(t);
            }
        }
    }

    function editName() {
        // If user confirms modal do the editing
        new Promise<string|undefined>((resolve) => {
            const data = userProfile.name ?? userProfile.displayName ?? "";
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: data, fieldName: 'Name'},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (editedData: string|undefined) => {
                    resolve(editedData); 
                },
            };
            modalStore.trigger(modal);
            // We got some kind of response from modal
        }).then((editedData: string|undefined) => {
                if (editedData) {
                    userProfile.name = editedData;
                    editProfile();
                }
            });

    }

    function editAbout() {
        new Promise<string|undefined>((resolve) => {
            const data = userProfile.about ?? userProfile.bio ?? "";
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: data, fieldName: 'About'},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (editedData: string|undefined) => {
                    resolve(editedData); 
                },
            };
            modalStore.trigger(modal);
            // We got some kind of response from modal
        }).then((editedData: string|undefined) => {
                if (editedData) {
                    userProfile.about = editedData;
                    editProfile();
                }
            });
    }

    function editLud16() {
        new Promise<string|undefined>((resolve) => {
            const data = userProfile.lud16 ?? "";
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: data, fieldName: 'LN Address'},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (editedData: string|undefined) => {
                    resolve(editedData); 
                },
            };
            modalStore.trigger(modal);
            // We got some kind of response from modal
        }).then((editedData: string|undefined) => {
                if (editedData) {
                    userProfile.lud16 = editedData;
                    editProfile();
                }
            });
    }

    // For tooltip    
    const popupWoT: PopupSettings = {
        event: 'click',
        target: 'partOfWoT',
        placement: 'bottom'
    };


</script>

{#if userProfile}
    <div class="card p-4 m-8 mt-4 bg-surface-200-700-token flex-grow sm:max-w-[70vw] lg:max-w-[60vw]">
        <header class="mb-8">
            <div class="grid grid-cols-[auto_1fr_auto] items-center justify-center gap-x-2">
                <div>
                    <Avatar 
                        class="rounded-full border-white"
                        src={
                            userProfile.image 
                                ?? `https://robohash.org/${user?.pubkey}`
                        }
                    /> 
                </div>
                <div class="flex items-center justify-center gap-x-4 ">
                    <h2 class="h2 text-center font-bold text-lg sm:text-2xl">
                        {userProfile.name ?? userProfile.displayName ?? 'Name?'}
                    </h2>
                    <span>
                        {#if partOfWoT}
                            <i 
                                class="fa-solid fa-circle-check text-2xl {trustColor}"
                                use:popup={popupWoT}
                            >
                            </i>
                            <div data-popup="partOfWoT">
                                <div class="card font-bold w-40 p-4 {bgTrustColor} max-h-60 overflow-y-auto">
                                    This person is part of your Web of Trust
                                    <div class="arrow {bgTrustColor}" />
                                </div>
                            </div>
                        {:else}
                            <i 
                                class="fa-solid fa-circle-question text-2xl {trustColor}"
                                use:popup={popupWoT}
                            >
                            </i>
                            <div data-popup="popupWoT">
                                <div class="card font-bold w-40 p-4 {bgTrustColor} max-h-60 overflow-y-auto">
                                    This person is NOT part of your Web of Trust!
                                    <div class="arrow {bgTrustColor}" />
                                </div>
                            </div>
                        {/if}
                    </span>
                </div>
                {#if editable}
                    <button class="justify-self-end" on:click={editName}>
                        <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-xl" />
                    </button>
                {/if}
            </div>
        </header>
        <div class="flex items-center gap-x-2">
            <h4 class="h4">About</h4>
            {#if editable}
                <button on:click={editAbout}>
                    <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                </button>
            {/if}
        </div>
        <div>{userProfile.about ?? userProfile.bio ?? '?'}</div>
        <footer class="mt-4">
            <h4 class="h4">Other:</h4>
            <div class="flex flex-col gap-y-1">
                <div class="flex items-center gap-x-2">
                    <div>Npub: {npub?.substring(0,20) + '...'}</div>
                    {#if npub}
                        <div>
                            <button 
                                class="btn btn-icon"
                                use:clipboard={npub}
                            >
                                <span>
                                    <i class='fa-regular fa-copy'/>
                                </span>
                            <button>
                        </div>
                    {/if}
                </div>
                <div class="flex items-center gap-x-2">
                    <div>
                        Nip05: {userProfile.nip05 ?? '?'}
                    </div>
                    {#if userProfile.nip05}
                        <div>
                            <button 
                                class="btn btn-icon "
                                use:clipboard={userProfile.nip05}
                            >
                                <span>
                                    <i class='fa-regular fa-copy'/>
                                </span>
                            <button>
                        </div>
                    {/if}
                </div>
                <div class=" flex items-center gap-x-2 ">
                    <div>LN address(lud16): {userProfile.lud16 ?? '?'}</div>
                    {#if editable}
                        <button on:click={editLud16}>
                            <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                        </button>
                    {/if}
                </div>
            </div>
        </footer>
    </div>
{:else}
    <section class="w-[300px] md:w-[400px]">
        <div class="p-4 space-y-4">
            <div class="grid grid-cols-[20%_1fr] gap-8 items-center">
                <div class="placeholder-circle animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
            <div class="grid grid-cols-3 gap-8">
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
            <div class="grid grid-cols-4 gap-4">
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
        </div>
    </section>
{/if}

