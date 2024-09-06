<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from '$lib/stores/user';
    import {
        NDKRelay, 
        type NDKUser,
        type NDKUserProfile
    } from "@nostr-dev-kit/ndk";

    import { wot } from '$lib/stores/wot';

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

    export let user: NDKUser;
    let userProfile:NDKUserProfile;
    $: npub = user.npub;
    $: editable = ($currentUser?.npub === npub);
    $: avatarImage = `https://robohash.org/${user.pubkey}`;
    $: nip05 = userProfile?.nip05;
    $: lud16 = userProfile?.lud16;

    $: website = userProfile?.website 
        ? userProfile.website.length <= 20
            ? userProfile.website
            : userProfile.website.substring(0,20) + '...'
        : '?'

    let validNIP05 = false;

    $: partOfWoT = ($wot.has(user.pubkey));
    $: trustColor = partOfWoT ? 'text-tertiary-500' : 'text-error-500';
    $: bgTrustColor = partOfWoT ? 'bg-tertiary-500' : 'bg-error-500';
    $: nip05TrustColor = validNIP05 ? 'text-tertiary-500' : 'text-error-500';
    $: bgNip05TrustColor = validNIP05 ? 'bg-tertiary-500' : 'bg-error-500';

    $: if (user) {
        console.log('setProfile')
        setProfile();
    }

    $: if (user && nip05) {
        console.log('nip05 to validate:', nip05)
        user.validateNip05(nip05).then((response:boolean|null)=>{
            console.log('nip05', response);
            if (response) {
                validNIP05 = true;
            }
        });
    }

    async function setProfile() {
        const profile = await user.fetchProfile();
        if (profile) {
            userProfile = profile;
            if (userProfile.image) {
                avatarImage = userProfile.image;
            }
        } 
    }

    async function editProfile() {
        if ($currentUser) {
            try {
                $currentUser.profile = userProfile;

                const blastrUrl = 'wss://nostr.mutinywallet.com';
                $ndk.pool.useTemporaryRelay(new NDKRelay(blastrUrl, undefined, $ndk));

                console.log('relays sending to:', $ndk.pool)
                await $currentUser.publish();

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

    function editWebsite() {
        new Promise<string|undefined>((resolve) => {
            const data = userProfile?.website ?? "";
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: data, fieldName: 'Website'},
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
                if (editedData != undefined) {
                    userProfile.website = editedData;
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

    const popupNip05: PopupSettings = {
        event: 'click',
        target: 'popupNip05',
        placement: 'bottom'
    };

</script>

<div class="card p-4 bg-surface-200-700-token flex-grow ">
    <header class="mb-8">
        <div class="grid grid-cols-[auto_1fr_auto] items-center justify-center gap-x-2">
            <div>
                <Avatar 
                class="rounded-full border-white"
                src={avatarImage}
            /> 
            </div>
            <div class="flex items-center justify-center gap-x-4 ">
                <h2 class="h2 text-center font-bold text-lg sm:text-2xl">
                    {userProfile?.name ?? userProfile?.displayName ?? npub.substring(0,10)}
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
                        <div data-popup="partOfWoT">
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
    <div class="flex items-center gap-x-2 ">
        <h4 class="h4 underline">About</h4>
        {#if editable}
            <button on:click={editAbout}>
                <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
            </button>
        {/if}
    </div>
    <div class="max-w-80">
        {userProfile?.about ?? userProfile?.bio ?? '?'}
    </div>
    <footer class="mt-4">
        <div class="flex flex-col gap-y-1">
            <div class="flex items-center gap-x-2">
                <div class="underline">Npub:</div>
                <div>{npub?.substring(0,20) + '...'}</div>
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
                <div class="flex gap-x-2">
                    <div class="underline">
                        Nip05:
                    </div>
                    <div>{nip05 ?? '?'}</div>
                </div>
                {#if nip05}
                    <div>
                        <button 
                            class="btn btn-icon "
                            use:clipboard={nip05}
                        >
                            <span>
                                <i class='fa-regular fa-copy'/>
                            </span>
                            <button>
                    </div>
                    <div>
                        {#if validNIP05}
                            <i 
                                class="fa-solid fa-circle-check text-xl {nip05TrustColor}"
                                use:popup={popupNip05}
                            >
                            </i>
                            <div data-popup="popupNip05">
                                <div class="card font-bold w-40 p-4 {bgNip05TrustColor} max-h-60 overflow-y-auto">
                                    Valid Nip05
                                    <div class="arrow {bgNip05TrustColor}" />
                                </div>
                            </div>
                        {:else}
                            <i 
                                class="fa-solid fa-circle-question text-xl {nip05TrustColor}"
                                use:popup={popupNip05}
                            >
                            </i>
                            <div data-popup="popupNip05">
                                <div class="card font-bold w-40 p-4 {bgNip05TrustColor} max-h-60 overflow-y-auto">
                                    Could NOT validate Nip05!
                                    <div class="arrow {bgNip05TrustColor}" />
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
            <div class="flex items-center gap-x-4">
                <div class="flex gap-x-2">
                    <div class="underline">Website:</div>
                    <a class="anchor" href={website}><div>{website}</div></a>
                </div>
                {#if editable}
                    <button on:click={editWebsite}>
                        <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                    </button>
                {/if}
            </div>
            <div class=" flex items-center gap-x-2 ">
                <div class="flex gap-x-2">
                    <div class="underline">LN Address:</div>
                    <div>{lud16 ?? '?'}</div>
                </div>
                {#if editable}
                    <button on:click={editLud16}>
                        <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                    </button>
                {/if}
            </div>
        </div>
    </footer>
</div>
