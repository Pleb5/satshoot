<script lang='ts'>
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
    import ndk from "$lib/stores/ndk";
    import { privateKeyFromSeedWords, generateSeedWords } from "nostr-tools/nip06"
    import { nsecEncode } from "nostr-tools/nip19"

    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import GenerateEphemeralKeyModal from "$lib/components/Modals/GenerateEphemeralKeyModal.svelte";
    import RestoreEphemeralKeyModal from "$lib/components/Modals/RestoreEphemeralKeyModal.svelte";

    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();

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

                user.fetchProfile().then(() => {
                    // Trigger UI update for profile image
                    $ndk.activeUser = $ndk.activeUser;
                });
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



    function onEphemeralLogin() {
        // Generate new Ephemeral private private key
        const seedWords = generateSeedWords();
        const privateKey = privateKeyFromSeedWords(seedWords); 

        $ndk.signer = new NDKPrivateKeySigner(privateKey);
        $ndk.signer?.user().then( (user:NDKUser) => {
            $ndk.activeUser = $ndk.activeUser;

            const modalComponent: ModalComponent = {
                ref: GenerateEphemeralKeyModal,
                props: {
                    seedWords: seedWords.split(' '), 
                    npub: user.npub,
                    nsec: nsecEncode(privateKey) 
                }
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        });
    }

    function onRestoreEphemeralKey() {
        // Restore Private Key from a modal prompt where user enters seed words
        const modalComponent: ModalComponent = {
            ref: RestoreEphemeralKeyModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    // For tootip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'top'
    };


</script>
<h1 class="h1 text-center my-8">Bitcoin Troubleshoot Login</h1>

<div class="flex items-center ">
    <div class="flex flex-col items-start gap-y-5 mx-auto">
        <div class="flex gap-x-4">
            <button class="btn btn-lg bg-primary-300-600-token " on:click={onNIP07Login}>
                <span>Connect NIP07 Browser Extension </span>
            </button>

            <a 
                class="btn btn-md bg-warning-300-600-token"
                href="https://getalby.com/"
                target="_blank"
            >
                <span>See Alby</span>
            </a>
        </div>
        <!-- Todo: Add tooltip hint '?' to explain that the ephemeral part refers to  -->
        <!-- local storage of key. Backed up nostr identities are not lost on clearing the browser local storage -->
        <div class="flex gap-x-4 items-center">
            <button class="btn btn-lg bg-primary-300-600-token " on:click={onEphemeralLogin}>
                <span>Generate NEW Ephemeral Nostr identity</span>
            </button>
            <i 
                class="text-primary-300-600-token fa-solid fa-circle-question text-2xl
                [&>*]:pointer-events-none" 
                use:popup={popupHover}
            />
            
            <div class="card w-80 p-4 bg-primary-300-600-token" data-popup="popupHover">
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

        <button class="btn btn-lg bg-primary-300-600-token " on:click={onRestoreEphemeralKey}>
            <span>Restore Ephemeral Nostr identity(Seed Words)</span>
        </button>

    </div>

</div>
