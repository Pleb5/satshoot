<script lang='ts'>
    import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
    import ndk, { type LoginMethod } from "$lib/stores/ndk";

    import redirectStore from "$lib/stores/network";
    import { loggedIn, loginMethod } from "$lib/stores/user";

    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';

    import { getToastStore,  popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings, ToastSettings } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import BunkerLoginModal from "$lib/components/Modals/BunkerLoginModal.svelte";
    import { initializeUser, checkRelayConnections } from "$lib/utils/helpers";
    import { onMount, tick } from "svelte";
    import Nip07LoginModal from "$lib/components/Modals/Nip07LoginModal.svelte";

    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    // Navigate to Home page if user is already logged in(needs to log out first)
    $: {
        if ($loggedIn) {
            if ($redirectStore) {
                goto($redirectStore)
                $redirectStore = '';
            } else {
                goto('/ticket-feed'); 
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
            const nip07Signer = new NDKNip07Signer();

            try {
                const modalComponent: ModalComponent = {
                    ref: Nip07LoginModal,
                };

                const modal: ModalSettings = {
                    type: 'component',
                    component: modalComponent,
                };

                modalStore.trigger(modal);
                await tick();

                const returnedUser = await nip07Signer.blockUntilReady();

                if (returnedUser.npub) {
                    modalStore.clear();
                    $loginMethod = 'nip07';
                    $ndk.signer = nip07Signer;
                    localStorage.setItem('login-method', $loginMethod as LoginMethod);
                    initializeUser($ndk);
                }
            } catch(e) {
                const t: ToastSettings = {
                    message: 'Browser extension rejected access!',
                    autohide: false,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
                modalStore.clear();
            }

        } else if (!window.nostr) {
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

    onMount(() => checkRelayConnections());

</script>

<div class="flex justify-center mt-4">
    <div class="flex flex-col items-center gap-y-5 m-4">
        <!-- Nsec bunker remote signer -->
        <button
            class="btn btn-icon btn-md lg:btn-lg bg-primary-300-600-token w-full h-20"
            on:click={onBunkerLogin}
        >
            <div class="flex flex-col items-center">
                <div class="flex items-center gap-x-2">
                    <i class="fa-solid fa-box fa-xl"></i>
                    <div>Bunker URL</div>
                </div>
                <div class="font-bold">
                    <span class="mr-2 text-2xl">🔒</span>
                    Most secure
                </div>
            </div>
        </button>
        <div class="grid grid-cols-2 gap-x-2 gap-y-4 mx-4">
            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://nsec.app/"
                target="_blank"
            >
                <span>See Nsec.app</span>
            </a>
            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://github.com/greenart7c3/Amber"
                target="_blank"
            >
                <div class="flex flex-col">
                    <div>See Amber</div>
                    <div>(Android)</div>
                </div>
            </a>
        </div>
        <!-- Nip07 browser extension -->
        <button
            class="btn btn-icon btn-md lg:btn-lg bg-primary-300-600-token mx-4 w-full h-20"
            on:click={onNIP07Login}
        >
            <div class="flex items-center gap-x-2">
                <i class="fa-solid fa-puzzle-piece fa-xl"></i>
                <div>Extension</div>
            </div>
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
        <a 
            href="/restore/"
            class="btn btn-icon btn-md lg:btn-lg w-full h-20 bg-primary-300-600-token"
        >
            <div class="flex flex-col items-center gap-y-2">
                <div class="flex gap-x-2 items-center">
                    <i class="fa-solid fa-key fa-xl"></i>
                    <div>Secret key</div>
                </div>
                <div 
                    class="text-error-500 bg-warning-500 font-bold p-2
                            badge"
                >
                    Stored in the Browser
                </div>
            </div>
        </a>
        <!-- New local keypair -->
        <div class="flex w-full h-20 gap-x-4 justify-center items-center">
            <a 
                href="/create-seed/" 
                class="btn btn-icon btn-md lg:btn-lg w-full h-full bg-tertiary-300-600-token "
            >
                <div class="flex gap-x-2 items-center">
                    <i class="fa-solid fa-circle-plus fa-xl"></i>
                    <div> New Secret Key</div>
                </div>
            </a>
            <i 
                class="text-tertiary-300-600-token fa-solid fa-circle-question text-2xl
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
