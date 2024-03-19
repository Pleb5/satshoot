<script lang="ts">
    import { NDKEvent, NDKRelaySet, type NDKUser, type NDKUserProfile } from "@nostr-dev-kit/ndk";

    import ndk from "$lib/stores/ndk";
    import { connected } from "$lib/stores/ndk";
    import EditProfileModal from "../Modals/EditProfileModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { Avatar } from "@skeletonlabs/skeleton";
    import { clipboard } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { beforeNavigate } from "$app/navigation";

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    /**
     * The npub of the user you want to display a user card for
     */
    export let npub: string | undefined = undefined;

    /**
     * The user object of the user you want to display a user card for
     */
    export let user: NDKUser | undefined = undefined;
    let profilePromise:Promise<NDKUserProfile | null>;

// Because of the two-way binding AND reactivity, we must ensure to run reactive profile fetch exactly ONCE
    let needProfile: boolean = true;
    let aboutText: string;
    let userNameText: string;
    let lud16Text:string;

    let editable = false;

    $: if ($ndk.activeUser && npub) {
        editable = $ndk.activeUser?.npub === npub;
        needProfile = true;
    }
    // Some strange behavior around ndk, user and ndk.activeUser when recursively
    // assigning ndk.getUser(npub) -> user.ndk = this -> user.ndk.activeUser = ...?
    // user.ndk.activeUser.ndk = .... ???!!! infinte recursion of assignments?
    $: {
        if (npub && needProfile && $connected) {
            console.log('need profile, fetching...')
            needProfile = false;
            let opts = { npub: npub };
            try {
                user = $ndk.getUser(opts);
                // ndk.activeUser is undefined at this point but
                // user.ndk.activeUser is the logged in user?!?!
                profilePromise = user.fetchProfile();
                profilePromise.then((profile:NDKUserProfile | null) => {
                    aboutText = profile?.about ?? user?.profile?.bio ?? ""; 
                    userNameText = profile?.name ?? user?.profile?.displayName ?? "";
                    lud16Text = profile?.lud16 ?? '';
                });
            } catch (e) {
                console.error(`error trying to get user`, { opts }, e);
            }
        }
    }

    // Represents the part of the profile to be updated
    interface ProfileUpdate {
       name: boolean;
       about: boolean,
       lud16: boolean,
    }

    async function editProfile(fieldsToUpdate: Partial<ProfileUpdate>) {
        const event = new NDKEvent($ndk);
        event.kind = 0;
        if (fieldsToUpdate['name']) {
            event.content = JSON.stringify({
                name: userNameText,
                display_name: userNameText,
                about: user?.profile?.about,
                bio: user?.profile?.bio,
                picture: user?.profile?.image,
                banner: user?.profile?.banner,
                nip05: user?.profile?.nip05,
                lud16: user?.profile?.lud16,
                website: user?.profile?.website,
            });
        } else if (fieldsToUpdate['about']) {
            event.content = JSON.stringify({
                name: user?.profile?.name,
                display_name: user?.profile?.displayName,
                about: aboutText,
                bio: aboutText,
                picture: user?.profile?.image,
                banner: user?.profile?.banner,
                nip05: user?.profile?.nip05,
                lud16: user?.profile?.lud16,
                website: user?.profile?.website,
            });
        } else if (fieldsToUpdate['lud16']) {
            event.content = JSON.stringify({
                name: user?.profile?.name,
                display_name: user?.profile?.displayName,
                about: user?.profile?.about,
                bio: user?.profile?.bio,
                picture: user?.profile?.image,
                banner: user?.profile?.banner,
                nip05: user?.profile?.nip05,
                lud16: lud16Text,
                website: user?.profile?.website,
            });
        } else {
            const t: ToastSettings = {
                message:`Profile update failed! Reason: No profile param provided for update!`,
            };
            toastStore.trigger(t);
            return;
        }
        if (user) {
            event.author = user;
            try {
                const relaysPublished = await event.publish(
                    new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)
                );
                profilePromise = user.fetchProfile();
                await profilePromise;
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

    // Here we overwrite both name and display_name
    function editName() {
        // If user confirms modal do the editing
        new Promise<string|undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: userNameText, fieldName: 'Name'},
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
                    userNameText = editedData;
                    editProfile({name:true});
                }
            });

    }

    // Here we overwrite both about and bio if possible
    function editAbout() {
        new Promise<string|undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: aboutText, fieldName: 'About'},
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
                    aboutText = editedData;
                    editProfile({about:true});
                }
            });
    }

    function editLud16() {
        new Promise<string|undefined>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: EditProfileModal,
                props: {dataToEdit: lud16Text, fieldName: 'LN Address'},
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
                    lud16Text = editedData;
                    editProfile({lud16:true});
                }
            });
    }

</script>

{#await profilePromise}
    <div class="" >Loading user...</div>
{:then userProfile}
    <div class="card p-4 m-8 mt-4">
        <header class="mb-8">
            <div class="grid grid-cols-[auto_1fr_auto] items-center justify-center gap-x-2">
                <div>
                    <Avatar 
                        class="rounded-full border-white placeholder-white"
                        src={userProfile?.image}
                    /> 
                </div>
                <div class=" flex items-center justify-center gap-x-2 ">
                    <h2 class="h2 text-center font-bold text-lg sm:text-2xl">{userProfile?.name ?? 'Name?'}</h2>
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
        <div>{userProfile?.bio ?? userProfile?.about ?? '?'}</div>
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
                        Nip05: {userProfile?.nip05 ?? '?'}
                    </div>
                    {#if userProfile?.nip05}
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
                    <div>LN address(lud16): {userProfile?.lud16 ?? '?'}</div>
                    {#if editable}
                        <button on:click={editLud16}>
                            <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                        </button>
                    {/if}
                </div>
            </div>
        </footer>
    </div>
{:catch error}
    <div class="text-error-400-500-token">Error fetching user: {error}</div>
{/await}

