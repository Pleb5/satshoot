<script lang="ts">
    import '../app.css';

    // Font awesome
    import '@fortawesome/fontawesome-free/css/brands.css';
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
    import '@fortawesome/fontawesome-free/css/solid.css';

    import ndk, { bunkerNDK, sessionPK } from '$lib/stores/ndk';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

    import { Dexie } from 'dexie';

    import { updated, pollUpdated } from '$lib/stores/app-updated';
    import { online, retryConnection } from '$lib/stores/network';
    import currentUser, { loggedIn, loggingIn, loginMethod, mounted } from '$lib/stores/user';

    import {
        allOffers,
        allTickets,
        myOffers,
        myTickets,
        wotFilteredOffers,
        wotFilteredTickets,
    } from '$lib/stores/freelance-eventstores';

    import { messageStore, wotFilteredMessageFeed } from '$lib/stores/messages';
    import { sendNotification } from '$lib/stores/notifications';
    import { allReviews, clientReviews, freelancerReviews } from '$lib/stores/reviews';
    import { allReceivedZaps, filteredReceivedZaps } from '$lib/stores/zaps';

    import { checkRelayConnections, initializeUser, logout } from '$lib/utils/helpers';

    import { wotUpdateFailed, wotUpdateNoResults } from '$lib/stores/wot';

    import { LoginMethod, RestoreMethod } from '$lib/stores/ndk';

    import {
        NDKKind,
        NDKNip07Signer,
        NDKNip46Signer,
        NDKPrivateKeySigner,
        NDKSubscription,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import { privateKeyFromSeedWords } from 'nostr-tools/nip06';

    import { privateKeyFromNsec } from '$lib/utils/nip19';

    import { page } from '$app/state';

    // Skeleton Toast
    import { Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

    // Skeleton Modals
    import DecryptSecretModal from '$lib/components/Modals/DecryptSecretModal.svelte';
    // Skeleton stores init
    import { beforeNavigate } from '$app/navigation';
    import Footer from '$lib/components/layout/Footer.svelte';
    import Header from '$lib/components/layout/Header.svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import type { TicketEvent } from '$lib/events/TicketEvent';

    import { searchTerms } from '$lib/stores/search';
    import { onDestroy, onMount, tick } from 'svelte';
    import SidebarLeft from '$lib/components/layout/SidebarLeft.svelte';
    import {
        getModeOsPrefers,
        getModeUserPrefers,
        setModeUserPrefers,
    } from '$lib/utils/lightSwitch';
    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();

    const toaster = createToaster();

    beforeNavigate(async ({ to }) => {
        if (to?.url.pathname !== '/jobs') {
            // clear search terms by initializing a new set
            searchTerms.set(new Set());
        }
    });

    let showDecryptSecretModal = $state(false);

    let searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    let filterList = $derived(searchQuery ? searchQuery.split(',') : []);

    // on page reload if url contains searchTerms add them to svelte store
    $effect(() => {
        if (filterList.length > 0) {
            searchTerms.set(new Set(filterList));
        }
    });

    let displayNav = $derived($loggedIn);
    let followSubscription = $state<NDKSubscription>();

    $effect(() => {
        if ($retryConnection === 0) {
            toaster.warning({
                title: 'Could not reconnect to Relays!',
                action: {
                    label: 'Reload page',
                    onClick: () => {
                        window.location.reload();
                    },
                },
            });
        }
    });

    $effect(() => {
        if ($wotUpdateFailed) {
            toaster.warning({
                title: 'Could not load Web of Trust!',
                action: {
                    label: 'Retry',
                    onClick: () => {
                        window.location.reload();
                    },
                },
            });
        }
    });

    $effect(() => {
        if ($wotUpdateNoResults) {
            toaster.warning({
                title: 'Your Web of Trust is Empty!',
                action: {
                    label: 'Retry',
                    onClick: () => {
                        window.location.reload();
                    },
                },
            });
        }
    });

    async function restoreLogin() {
        // For UI feedback
        $loggingIn = true;
        await tick();

        migrateLoginMethod();

        // Try to get saved Login method from localStorage and login that way
        $loginMethod = (localStorage.getItem('login-method') as LoginMethod) ?? null;

        if (!$loginMethod) {
            $loggingIn = false;
            return;
        }

        switch ($loginMethod) {
            case LoginMethod.Local:
                handleLocalLogin();
                break;
            case LoginMethod.Bunker:
                handleBunkerLogin();
                break;
            case LoginMethod.Nip07:
                handleNip07Login();
                break;
        }
    }

    function migrateLoginMethod() {
        // Migration to login-method = 'local'  instead of 'ephemeral'
        let method = localStorage.getItem('login-method');
        if (method === 'ephemeral') {
            localStorage.setItem('login-method', 'local');
        }
    }

    function handleLocalLogin() {
        // We either get the private key from sessionStorage or decrypt from localStorage
        if ($sessionPK) {
            $ndk.signer = new NDKPrivateKeySigner($sessionPK);
            $loggingIn = false;

            initializeUser($ndk);
            return;
        }

        showDecryptSecretModal = true;
    }

    function decryptSecretModalCallback(res: {
        decryptedSecret?: string;
        restoreMethod?: RestoreMethod;
    }) {
        // Get decrypted seed from a modal prompt where user enters passphrase
        // User can dismiss modal in which case decryptedSeed is undefined
        const { decryptedSecret, restoreMethod } = res;

        if (!decryptedSecret) {
            showErrorToast(
                'Could not get decrypted secret. Clear browser local storage and login again.'
            );
            return;
        }

        if (!restoreMethod) {
            showErrorToast(
                'Could not get restore method. Clear browser local storage and login again.'
            );
            return;
        }

        const privateKey = getPrivateKeyFromDecryptedSecret(decryptedSecret, restoreMethod);

        if (!privateKey) {
            showErrorToast(
                'Could not create hex private key from decrypted secret. Clear browser local storage and login again.'
            );
            return;
        }

        $ndk.signer = new NDKPrivateKeySigner(privateKey);
        $sessionPK = privateKey;

        initializeUser($ndk);
    }

    function getPrivateKeyFromDecryptedSecret(
        decryptedSecret: string,
        restoreMethod: RestoreMethod
    ): string | undefined {
        switch (restoreMethod) {
            case RestoreMethod.Seed:
                return privateKeyFromSeedWords(decryptedSecret);
            case RestoreMethod.Nsec:
                return privateKeyFromNsec(decryptedSecret);
            default:
                return undefined;
        }
    }

    async function handleBunkerLogin(): Promise<void> {
        const localBunkerKey = localStorage.getItem('bunkerLocalSignerPK');
        const bunkerTargetNpub = localStorage.getItem('bunkerTargetNpub');
        const bunkerRelayURLsString = localStorage.getItem('bunkerRelayURLs');

        if (!localBunkerKey || !bunkerTargetNpub || !bunkerRelayURLsString) {
            return;
        }

        const bunkerRelayURLs = bunkerRelayURLsString.split(',');

        // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
        bunkerRelayURLs.forEach((url) => $bunkerNDK.addExplicitRelay(url));

        await $bunkerNDK.connect();
        console.log('ndk connected to specified bunker relays', $bunkerNDK.pool.connectedRelays());

        setupBunkerTimeout();

        try {
            const localSigner = new NDKPrivateKeySigner(localBunkerKey);
            const remoteSigner = new NDKNip46Signer($bunkerNDK, bunkerTargetNpub, localSigner);

            const returnedUser = await remoteSigner.blockUntilReady();
            if (returnedUser.npub) {
                $ndk.signer = remoteSigner;
                initializeUser($ndk);
                $loggingIn = false;
            }
        } catch (e) {
            showBunkerConnectionError(e);
        }
    }

    function setupBunkerTimeout() {
        setTimeout(() => {
            if (!$ndk.signer) {
                toaster.warning({
                    title: 'Bunker connection took too long!',
                    description: 'Fix or Remove Bunker Connection!',
                    action: {
                        label: 'Delete Bunker Connection',
                        onClick: () => logout(),
                    },
                });
            }
        }, 20000);
    }

    function showBunkerConnectionError(error: any) {
        toaster.error({
            title: 'Could not connect to Bunker!',
            description: `Reason: ${error}`,
        });
    }

    function handleNip07Login() {
        if (!$ndk.signer) {
            $ndk.signer = new NDKNip07Signer();
            initializeUser($ndk);
            $loggingIn = false;
        }
    }

    function showErrorToast(message: string) {
        toaster.error({
            title: message,
        });
    }

    function configureBasics() {
        localStorage.debug = '*';
        const mode = getModeUserPrefers();
        if (!mode) {
            const modeAutoPrefers = getModeOsPrefers();
            setModeUserPrefers(modeAutoPrefers);
            document.documentElement.setAttribute('data-mode', modeAutoPrefers);
        } else {
            document.documentElement.setAttribute('data-mode', mode);
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            showAppInstallPromotion = true;
        });

        window.addEventListener('offline', () => {
            console.log('offline');
            toaster.warning({
                title: 'Offline',
            });
            $online = false;
        });

        window.addEventListener('online', () => {
            $online = true;

            window.location.reload();
        });

        // We need to check relay connections on regaining focus,
        // especially on mobile where user can put app in the background
        window.addEventListener('focus', () => {
            checkRelayConnections();
        });

        window.onunhandledrejection = async (event: PromiseRejectionEvent) => {
            event.preventDefault();
            console.log(event.reason);
            if (event.reason?.name === Dexie.errnames.DatabaseClosed) {
                console.log(
                    'Could not open Dexie DB, probably version change. Deleting old DB and reloading...'
                );
                await Dexie.delete('satshoot-db');
                // Must reload to open a brand new DB
                window.location.reload();
            }
        };
    }

    onMount(async () => {
        console.log('onMount layout');

        // Start polling for app updates
        pollUpdated();

        $mounted = true;
        // Setup client-side caching
        if (!$ndk.cacheAdapter) {
            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });
        }

        configureBasics();

        await $ndk.connect();

        if (!$loggedIn) {
            restoreLogin();
        }
    });

    onDestroy(() => {
        console.log('layout on destroy');

        if (followSubscription) followSubscription.stop();

        if (allTickets) allTickets.empty();
        if (allOffers) allOffers.empty();
        if (myTickets) myTickets.empty();
        if (myOffers) myOffers.empty();

        if (messageStore) messageStore.empty();
        if (allReceivedZaps) allReceivedZaps.empty();
        if (allReviews) allReviews.empty();
    });

    // Check for app updates and offer reload option to user in a Toast
    $effect(() => {
        if ($updated) {
            toaster.info({
                title: 'New version of the app is available!',
                action: {
                    label: 'Reload',
                    onClick: () => {
                        // Reload new page circumventing browser cache
                        location.href = location.pathname + '?v=' + new Date().getTime();
                    },
                },
            });
        }
    });

    // Install App promotion
    let deferredInstallPrompt = $state<BeforeInstallPromptEvent>();
    let showAppInstallPromotion = $state(false);
    $effect(() => {
        if (showAppInstallPromotion) {
            showAppInstallPromotion = false;

            const toastId = toaster.create({
                title: 'Install app for a better experience!',
                type: 'info',
                action: {
                    label: 'Install',
                    onClick: async () => {
                        toaster.remove(toastId);
                        deferredInstallPrompt.prompt();
                        // Find out whether the user confirmed the installation or not
                        const { outcome } = await deferredInstallPrompt.userChoice;
                        // The deferredInstallPrompt can only be used once.
                        deferredInstallPrompt = null;
                        // Act on the user's choice
                        if (outcome === 'accepted') {
                            console.log('User accepted the install prompt.');
                        } else if (outcome === 'dismissed') {
                            console.log('User dismissed the install prompt');
                        }
                    },
                },
            });
        }
    });

    // ----- Notifications ------ //
    $effect(() => {
        if ($wotFilteredTickets && $myOffers) {
            // console.log('all tickets change:', $wotFilteredTickets)
            $wotFilteredTickets.forEach((t: TicketEvent) => {
                $myOffers.forEach((o: OfferEvent) => {
                    if (o.referencedTicketDTag === t.dTag) {
                        // If users offer won send that else just send relevant ticket
                        if (t.acceptedOfferAddress === o.offerAddress) {
                            sendNotification(o);
                        } else {
                            sendNotification(t);
                        }
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($wotFilteredOffers && $myTickets) {
            // console.log('all offers change:', $wotFilteredOffers)
            $wotFilteredOffers.forEach((o: OfferEvent) => {
                $myTickets.forEach((t: TicketEvent) => {
                    if (o.referencedTicketDTag === t.dTag) {
                        sendNotification(o);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($wotFilteredMessageFeed && $currentUser) {
            $wotFilteredMessageFeed.forEach((dm: NDKEvent) => {
                // This is somewhat wasteful: If there was a nice way to attach
                // a callback on uniquely new events in NDKEventStore-s
                // We would not have to iterate over the whole array
                if (dm.pubkey !== $currentUser.pubkey) {
                    sendNotification(dm);
                }
            });
        }
    });

    $effect(() => {
        if ($clientReviews) {
            $clientReviews.forEach((r: ReviewEvent) => {
                $myTickets.forEach((t: TicketEvent) => {
                    if (t.ticketAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($freelancerReviews) {
            $freelancerReviews.forEach((r: ReviewEvent) => {
                $myOffers.forEach((o: OfferEvent) => {
                    if (o.offerAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($filteredReceivedZaps && $currentUser) {
            $filteredReceivedZaps.forEach((zap: NDKEvent) => {
                sendNotification(zap);
            });
        }
    });

    $effect(() => {
        if ($currentUser) {
            if (!followSubscription) {
                followSubscription = $ndk.subscribe(
                    {
                        kinds: [NDKKind.KindScopedFollow],
                        '#k': [
                            NDKKind.FreelanceTicket.toString(),
                            NDKKind.FreelanceOffer.toString(),
                        ],
                        '#p': [$currentUser.pubkey],
                    },
                    {
                        closeOnEose: false,
                    }
                );

                followSubscription.on('event', (event) => {
                    sendNotification(event);
                });
            }
        }
    });
</script>

<Toaster classes="z-1100" {toaster}></Toaster>

<!-- layout structure -->
<div class="grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden">
    <!-- Fixed Header -->
    <header class="sticky top-0 z-10 bg-surface-100-800 p-4" aria-label="Main header">
        <Header on:restoreLogin={restoreLogin} />
    </header>

    <!-- Content Area -->
    <div class="flex flex-1 overflow-hidden">
        <!-- Collapsible Sidebar (hidden on small screens) -->
        {#if displayNav}
            <aside class="hidden sm:block">
                <SidebarLeft />
            </aside>
        {/if}

        <!-- Main Content - improved accessibility -->
        <main class="flex-1 overflow-y-auto p-4" aria-label="Main content">
            {@render children?.()}
        </main>
    </div>

    <!-- Mobile Footer  -->
    {#if displayNav}
        <footer class="fixed bottom-0 w-full sm:hidden" aria-label="Mobile navigation">
            <Footer />
        </footer>
    {/if}
</div>

<DecryptSecretModal bind:isOpen={showDecryptSecretModal} callback={decryptSecretModalCallback} />
