<script lang='ts'>
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
    import ndk from "$lib/stores/ndk";
    import { privateKeyFromSeedWords, generateSeedWords } from "nostr-tools/nip06"

    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';

    import type { ModalSettings, ModalComponent, ModalStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import FullscreenModal from "$lib/components/Modals/FullscreenModal.svelte";

    // Navigate to Home page if user is already logged in(needs to log out first)
    $: {
        if ($ndk.activeUser) {
           goto('/'); 
        }
    }

    async function onNIP07Login() {
        if (browser && window.nostr) {
            $ndk.signer = new NDKNip07Signer();

            $ndk.signer.user().then( (user:NDKUser) => {
                localStorage.setItem('signin-method', "nip07");
                $ndk.activeUser = $ndk.activeUser;

                if (user.npub) {
                    console.log("Permission granted:", user.npub)
                }
            });
        }

        else if (!window.nostr) {
            const modal: ModalSettings = {
                type: 'alert',
                // Data
                title: 'No Compatible Extension!',
                body: 'No nip07-compatible browser extension found! See Alby, nos2x or similar!',
                buttonTextCancel:'Cancel',
            };

            modalStore.trigger(modal);
        }
    }


    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();

    function onEphemeralLogin() {
        // Generate new Ephemeral private private key
        const seedWords = generateSeedWords();
        const privateKey = privateKeyFromSeedWords(seedWords); 

        $ndk.signer = new NDKPrivateKeySigner(privateKey);
        console.log("Ephemeral nostr user seed words:", seedWords);
        $ndk.signer?.user().then( (user:NDKUser) => {
            $ndk.activeUser = $ndk.activeUser;

            // Save private key seed words in browser localStorage
            localStorage.setItem('nostr-seedwords', seedWords);
            // todo: enum for signing methods
            localStorage.setItem('signin-method', "ephemeral");

            console.log("ephemeral user npub: ", user.npub);

            const modalComponent: ModalComponent = { ref: FullscreenModal, props: {seedWords: seedWords} };
            console.log(modalComponent)
            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        });
    }

</script>
<h1 class="h1 text-center my-8">Bitcoin Troubleshoot Login</h1>

<div class="flex items-center ">
    <div class="flex flex-col items-start gap-y-5 mx-auto">
        <div class="flex gap-x-4">
            <button class="btn btn-lg bg-primary-300-600-token " on:click={onNIP07Login}>
                <span>Browser Extension </span>
            </button>

            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://getalby.com/"
                target="_blank"
            >
                <span>See Alby</span>
            </a>
        </div>

        <button class="btn btn-lg bg-primary-300-600-token " on:click={onEphemeralLogin}>
            <span>Generate ephemeral Nostr identity</span>
        </button>

        <button class="btn btn-lg bg-primary-300-600-token " >
            <span>Login with nsecBunker</span>
        </button>
    </div>

</div>
