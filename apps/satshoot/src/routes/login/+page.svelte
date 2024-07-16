<script lang='ts'>
    import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
    import ndk from "$lib/stores/ndk";

    import redirectStore from "$lib/stores/network";
    import { loggedIn } from "$lib/stores/user";

    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import BunkerLoginModal from "$lib/components/Modals/BunkerLoginModal.svelte";
    import { initializeUser } from "$lib/utils/helpers";

    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();

    // Navigate to Home page if user is already logged in(needs to log out first)
    $: {
        if ($loggedIn) {
            if ($redirectStore) {
                goto($redirectStore)
                $redirectStore = '';
            } else {
                goto('/'); 
            }
        }
    }

    async function onBunkerLogin() {
        const modalComponent: ModalComponent = {
            ref: BunkerLoginModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);

    }

    async function onNIP07Login() {
        if (browser && window.nostr) {
            $ndk.signer = new NDKNip07Signer();
            localStorage.setItem('login-method', "nip07");

            initializeUser($ndk);
        }

        else if (!window.nostr) {
            const modal: ModalSettings = {
                type: 'alert',
                title: 'No Compatible Extension!',
                body: 'No nip07-compatible browser extension found! See Alby, nos2x or similar!',
                buttonTextCancel:'Cancel',
            };
            modalStore.trigger(modal);
        }
    }

    // For tooltip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'bottom'
    };


</script>

<div class="flex items-center mt-4">

    <div class="flex flex-col items-start gap-y-5 mx-auto">
        <!-- Nsec bunker remote signer -->
        <button class="btn btn-md lg:btn-lg bg-primary-300-600-token mx-4" on:click={onBunkerLogin}>
            <span>Nsec Bunker(most secure)</span>
        </button>
        <div class="grid grid-cols-2 gap-x-2 gap-y-4 mx-4">
            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://nsec.app/"
                target="_blank"
            >
                <span>See Nsec.app</span>
            </a>
        </div>
        <!-- Nip07 browser extension -->
        <button class="btn btn-md lg:btn-lg bg-primary-300-600-token mx-4 mt-4" on:click={onNIP07Login}>
            <span>NIP07 Browser Extension </span>
        </button>
        <div class="grid grid-cols-2 gap-x-2 gap-y-4 mx-4">
            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://getalby.com/"
                target="_blank"
            >
                <span>See Alby</span>
            </a>

            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp?pli=1
"
                target="_blank"
            >
                <span>See nos2x</span>
            </a>

            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://chromewebstore.google.com/detail/horse/ogdjeglchjlenflecdcoonkngmmipcoe"
                target="_blank"
            >
                <span>See horse</span>
            </a>

            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://www.getflamingo.org/"
                target="_blank"
            >
                <span>See Flamingo</span>
            </a>
        </div>
        <!-- Restore Local keypair -->
        <a href="/restore/" class="btn btn-md lg:btn-lg mx-4 mt-4 bg-primary-300-600-token">
            <span>LOGIN with Local Keypair</span>
        </a>
        <!-- New local keypair -->
        <div class="flex gap-x-4 items-center mx-4 mt-4">
            <a href="/create-seed/" class="btn btn-md lg:btn-lg bg-primary-300-600-token ">
                <span>NEW Local Keypair</span>
            </a>
            <i 
                class="text-primary-300-600-token fa-solid fa-circle-question text-2xl
                [&>*]:pointer-events-none" 
                use:popup={popupHover}
            />

            <div data-popup="popupHover">
                <div class="card w-80 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto">
                    <p>
                        Generate a new nostr keypair from bip39 seed words.
                        The words will be stored in browser local storage in an encrypted form.
                        Whenever you clear the browser local storage(e.g. delete cookies)
                        you need to restore the nostr key from the bip39 words.
                    </p>
                    <br/>
                    <p>
                        This identity can be used anywhere in the nostr ecosystem.
                        Take care of the words and don't store them unencrypted in digital form. 
                        If you intend to use it in the long run, also create a physical backup:
                    </p>
                    <br/>
                    <ul>
                        <li>
                            - Write them down on a piece of paper and laminate it
                        </li>
                        <li>
                            - Or backup in steel like bitcoiners do with seed words
                        </li>
                    </ul>
                    <div class="arrow bg-primary-300-600-token" />
                </div>
            </div>
        </div>
    </div>

</div>
