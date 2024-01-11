<script lang="ts">
    import { Modal } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';

    import ndk from '$lib/stores/ndk';

    const modalStore = getModalStore();

    function logout() {
        const modalBody = `
            <p>Do really you wish to log out?</p>
            <strong class="text-error-400-500-token">If you are logged in with an ephemeral account, it will be deleted!</strong>`;

        let logoutResponse = function(r: boolean){
            if (r) {
                localStorage.clear();
                $ndk.activeUser = undefined;
                $ndk.signer = undefined;
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
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-solid fa-user" /></span>
                    <span>Profile</span>
                </a>
            </li>
            <li>
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-solid fa-globe" /></span>
                    <span>Network</span>
                </a>
            </li>
            <li>
                <a href="/">
                    <span class="w-6 text-center"><i class="fa-solid fa-wand-sparkles" /></span>
                    <span>Theme</span>
                </a>
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
            <li>
                <button on:click={logout}>
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-arrow-right-from-bracket" />
                    </span>
                    <span>Logout</span>
                </button>
            </li>
        </ul>
    </nav>
</div>

