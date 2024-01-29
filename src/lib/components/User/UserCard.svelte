<script lang="ts">
    import { NDKEvent, NDKRelaySet, type NDKUser, type NDKUserProfile } from "@nostr-dev-kit/ndk";
    import type NDK from "@nostr-dev-kit/ndk";

    import { Avatar } from "@skeletonlabs/skeleton";
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    const toastStore = getToastStore();

    /**
     * The NDK instance you want to use
     */
    export let ndk: NDK;

    /**
     * The npub of the user you want to display a user card for
     */
    export let npub: string | undefined = undefined;

    /**
     * The user object of the user you want to display a user card for
     */
    export let user: NDKUser | undefined = undefined;
    let profilePromise:Promise<NDKUserProfile | null>;

    let aboutText:string; 
    let userNameText: string;
    let lud16Text:string;


    let editable: boolean = ndk.activeUser?.npub === npub;
    // Some strange behavior around ndk, user and ndk.activeUser when recursively
    // assigning ndk.getUser(npub) -> user.ndk = this -> user.ndk.activeUser = ...?
    // user.ndk.activeUser.ndk = .... ???!!! infinte recursion of assignments?
    $: {
        editable = ndk.activeUser?.npub === npub;

        if (!user) {
            let opts = { npub };
            try {
                user = ndk.getUser(opts);
                // ndk.activeUser is undefined at this point but
                // user.ndk.activeUser is the logged in user?!?!
                profilePromise = user.fetchProfile();
                profilePromise.then((profile:NDKUserProfile | null) => {
                    aboutText = profile?.about ?? user?.profile?.bio ?? ""; 
                    userNameText = profile?.name ?? user?.profile?.displayName ?? "";
                })
            } catch (e) {
                console.error(`error trying to get user`, { opts }, e);
            }
        }
    }

    const editNamePopup: PopupSettings = {
        event: 'click',
        target: 'editNamePopup',
        placement: 'bottom'
    };
    const editAboutPopup: PopupSettings = {
        event: 'click',
        target: 'editAboutPopup',
        placement: 'bottom'
    };
    const editLud16Popup: PopupSettings = {
        event: 'click',
        target: 'editLud16Popup',
        placement: 'right'
    };

    // Represents the part of the profile to be updated
    interface ProfileUpdate {
       name: boolean;
       about: boolean,
       lud16: boolean,
    }

    async function editProfile(fieldsToUpdate: Partial<ProfileUpdate>) {
        const event = new NDKEvent(ndk);
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
        console.log("event to publish: ", event)
        if (user) {
            event.author = user;
            try {
                const relaysPublished = await event.publish(new NDKRelaySet(new Set(ndk.pool.relays.values()), ndk));
                console.log('RelaysPublished',relaysPublished)
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
        editProfile({name:true});
    }

    // Here we overwrite both about and bio if possible
    function editAbout() {
        editProfile({about:true});
    }

    function editLud16() {
        editProfile({lud16:true})
    }

</script>

{#await profilePromise}
    <div class="" >Loading user...</div>
{:then userProfile}
    <div class="card p-4">
        <header class="mb-8">
            <div class="grid grid-cols-3 justify-evenly">
                <Avatar 
                    class="rounded-full border-white placeholder-white"
                    src={userProfile?.image}
                /> 
                <div class=" flex items-center justify-center gap-x-2 ">
                    <h2 class="h2 text-center font-bold text-2xl">{userProfile?.name}</h2>
                    {#if editable}
                        <button use:popup={editNamePopup}>
                            <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-xl" />
                        </button>
                        <div class="card p-4 bg-primary-300-600-token" data-popup="editNamePopup">
                            <h4 class="h4 text-center">Edit Name</h4>
                            <form on:submit|preventDefault={editName}>
                                <div class="flex flex-col justify-center gap-y-2">
                                    <input 
                                        type="text"
                                        class="input"
                                        placeholder="New Name"
                                        bind:value={userNameText}
                                    />
                                    <button 
                                        type="submit" 
                                        class="btn btn-lg mt-4 bg-success-300-600-token"
                                    >
                                        Change
                                    </button>
                                </div>
                            </form>
                        </div>
                    {/if}
                </div>
            </div>
        </header>
        <div class="flex items-center gap-x-2">
            <h4 class="h4">About</h4>
            {#if editable}
                <button use:popup={editAboutPopup}>
                    <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                </button>
                <div class="card p-4 bg-primary-300-600-token w-96" data-popup="editAboutPopup">
                    <h4 class="h4 text-center">Edit About</h4>
                    <form on:submit|preventDefault={editAbout}>
                        <div class="flex flex-col justify-center gap-y-4">
                            <textarea 
                                rows="6"
                                class="textarea"
                                placeholder="Write about yourself"
                                bind:value={aboutText}
                            />
                            <button type="submit" class="btn btn-lg bg-success-300-600-token">Publish</button>
                        </div>
                    </form>
                    <div class="arrow bg-primary-300-600-token" />
                </div>
            {/if}
        </div>
        <div>{userProfile?.bio ?? userProfile?.about}</div>
        <footer class="mt-4">
            <h4 class="h4">Other:</h4>
            <div class="flex flex-col gap-y-1">
                <div>Npub: {npub}</div>
                <div>Nip05: {userProfile?.nip05 ?? '?'}</div>
                <div class=" flex items-center gap-x-2 ">
                    <div>LN address(lud16): {userProfile?.lud16 ?? '?'}</div>
                    {#if editable}
                        <button use:popup={editLud16Popup}>
                            <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-lg" />
                        </button>
                        <div class="card p-4 bg-primary-300-600-token" data-popup="editLud16Popup">
                            <h4 class="h4 text-center">Edit LN address</h4>
                            <form on:submit|preventDefault={editLud16}>
                                <div class="flex flex-col justify-center gap-y-2">
                                    <input 
                                        type="text"
                                        class="input"
                                        placeholder="New Address"
                                        bind:value={lud16Text}
                                    />
                                    <button 
                                        type="submit" 
                                        class="btn btn-lg mt-4 bg-success-300-600-token"
                                    >
                                        Change
                                    </button>
                                </div>
                            </form>
                        </div>
                    {/if}
                </div>
            </div>
        </footer>
    </div>
{:catch error}
    <div class="text-error-400-500-token">Error fetching user: {error}</div>
{/await}

