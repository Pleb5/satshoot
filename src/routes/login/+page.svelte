<script lang='ts'>
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
    import ndk from "$lib/stores/ndk";
    import { myTickets, myOffers , myTicketFilter, myOfferFilter } from "$lib/stores/troubleshoot-eventstores";

    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';

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

            let user: NDKUser = await $ndk.signer.user();
            localStorage.setItem('login-method', "nip07");

            myTicketFilter.authors?.push(user.pubkey);
            myOfferFilter.authors?.push(user.pubkey);
            myTickets.startSubscription();
            myOffers.startSubscription();

            await user.fetchProfile();

            // Trigger UI update for profile
            $ndk.activeUser = $ndk.activeUser;

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

    // For tooltip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'bottom'
    };


</script>

<div class="flex items-center mt-8">
    <div class="flex flex-col items-start gap-y-5 mx-auto">
        <button class="btn btn-md lg:btn-lg bg-primary-300-600-token mx-4" on:click={onNIP07Login}>
            <span>Connect NIP07 Browser Extension </span>
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
        <div class="flex gap-x-4 items-center mx-4 mt-8">
            <a href="/create-seed" class="btn btn-md lg:btn-lg bg-primary-300-600-token ">
                <span>NEW Local Nostr Keypair</span>
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

        <a href="/restore" class="btn mx-4 mt-8 bg-primary-300-600-token">
            <span>RESTORE Local Keypair</span>
        </a>

    </div>

</div>
