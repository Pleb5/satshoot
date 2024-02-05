<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';

    import { LightSwitch } from '@skeletonlabs/skeleton';

    import ndk from '$lib/stores/ndk';
    import {DEFAULTRELAYURLS, blacklistedRelays, storedPool, sessionPK } from "$lib/stores/ndk";
    import { goto } from '$app/navigation';
    import NDKSvelte from '@nostr-dev-kit/ndk-svelte';

    const modalStore = getModalStore();

    function logout() {
        const modalBody = `
<p>Do really you wish to log out?</p>
<strong class="text-error-400-500-token">If you are logged in with an ephemeral account, it will be deleted!</strong>`;

        let logoutResponse = async function(r: boolean){
            if (r) {
                localStorage.clear();
                // Reset local storage pool and blacklist
                blacklistedRelays.set([]);
                storedPool.set(DEFAULTRELAYURLS);

                $sessionPK = '';
                sessionStorage.clear();

                ndk.set(new NDKSvelte({
                    enableOutboxModel: false,
                    explicitRelayUrls: DEFAULTRELAYURLS,
                }));

                await $ndk.connect();

                console.log($ndk.explicitRelayUrls)
                goto('/');
            }
        }


        const modal: ModalSettings = {
            type: 'confirm',
            // Data
            title: 'Confirm log out',
            body: modalBody,
            response: logoutResponse,
        };
        modalStore.trigger(modal);

    }
</script>

<div data-popup="settingsMenu" class="card p-4 w-60 shadow-xl ">
    <nav class="list-nav">
        <ul>
            <li>
                <a href={ "/" + $ndk.activeUser?.npub }>
                    <span class="w-6 text-center"><i class="fa-solid fa-user" /></span>
                    <span>Profile</span>
                </a>
            </li>
            <li>
                <a href="/network">
                    <span class="w-6 text-center"><i class="fa-solid fa-globe" /></span>
                    <span>Network</span>
                </a>
            </li>
            <li>
                <div class="flex justify-between px-4 py-2">
                    <span class="w-6 text-center"><i class="fa-solid fa-wand-sparkles" /></span>
                    <span>Theme</span>
                    <LightSwitch />
                </div>
            </li>
            <hr class="!my-4" />
            <li>
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-solid fa-question" /></span>
                    <span>FAQ</span>
                </a>
            </li>
            <li>
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-solid fa-info" /></span>
                    <span>About</span>
                </a>
            </li>
            <li>
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-regular fa-comment" /></span>
                    <span>Feedback</span>
                </a>
            </li>
            <hr class="!my-4" />
            <li>
                <button class="w-full" on:click={logout}>
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-arrow-right-from-bracket" />
                    </span>
                    <span>Logout</span>
                </button>
            </li>
        </ul>
    </nav>
</div>

