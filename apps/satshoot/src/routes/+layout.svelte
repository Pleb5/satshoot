<script lang="ts">
    import '../app.css';

    // Font awesome
    import '@fortawesome/fontawesome-free/css/brands.css';
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
    import '@fortawesome/fontawesome-free/css/solid.css';

    import ndk, { bunkerNDK, bunkerRelayConnected, sessionInitialized, sessionPK } from '$lib/stores/session';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

    import { Dexie } from 'dexie';

    import { updated, pollUpdated } from '$lib/stores/app-updated';
    import { online, retriesLeft } from '$lib/stores/network';
    import currentUser, { loggedIn, loggingIn, loginMethod, mounted } from '$lib/stores/user';

    import {
        allBids,
        allJobs,
        myBids,
        myJobs,
        wotFilteredBids,
        wotFilteredJobs,
    } from '$lib/stores/freelance-eventstores';

    import { messageStore, wotFilteredMessageFeed } from '$lib/stores/messages';
    import { sendNotification } from '$lib/stores/notifications';
    import { allReviews, clientReviews, freelancerReviews } from '$lib/stores/reviews';
    import { allReceivedZaps, filteredReceivedZaps } from '$lib/stores/zaps';

    import { checkRelayConnections, initializeUser, logout } from '$lib/utils/helpers';

    import { wotUpdateFailed, wotUpdateNoResults } from '$lib/stores/wot';

    import { LoginMethod, RestoreMethod } from '$lib/stores/session';

    import {
        NDKKind,
        NDKNip07Signer,
        NDKNip46Signer,
        NDKPrivateKeySigner,
        NDKRelay,
        NDKSubscription,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import { privateKeyFromSeedWords } from 'nostr-tools/nip06';

    import { privateKeyFromNsec } from '$lib/utils/nip19';

    import { page } from '$app/state';

    // Skeleton Toast
    import Toaster from '$lib/components/UI/Toasts/Toaster.svelte';
    import { toaster } from '$lib/stores/toaster';

    // Skeleton Modals
    import DecryptSecretModal from '$lib/components/Modals/DecryptSecretModal.svelte';
    // Skeleton stores init
    import { goto } from '$app/navigation';
    import Footer from '$lib/components/layout/Footer.svelte';
    import Header from '$lib/components/layout/Header.svelte';
    import type { BidEvent } from '$lib/events/BidEvent';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import type { JobEvent } from '$lib/events/JobEvent';

    import { onDestroy, onMount, tick } from 'svelte';
    import SidebarLeft from '$lib/components/layout/SidebarLeft.svelte';
    import {
        getModeOsPrefers,
        getModeUserPrefers,
        setModeUserPrefers,
    } from '$lib/utils/lightSwitch';
    import { jobPostSuccessState, bidTakenState } from '$lib/stores/modals';
    import JobPostSuccess from '$lib/components/Modals/JobPostSuccess.svelte';
    import BidTakenModal from '$lib/components/Modals/BidTakenModal.svelte';

    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();

    let showDecryptSecretModal = $state(false);

    const displayNav = $derived($loggedIn);
    const hideBottomNav = $derived(page.route.id === '/messages/[jobId=event]');
    const displayFooter = $derived(displayNav && !hideBottomNav);
    let footerHeight = $state(0);
    let followSubscription = $state<NDKSubscription>();

    $effect(() => {
        if ($retriesLeft === 0) {
            toaster.warning({
                title: 'Could not reconnect to Relays!',
                duration: 60000, // 1 min
                action: {
                    label: 'Check relays',
                    onClick: () => {
                        goto('/settings/relays');
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

        if (!$loginMethod) {
            $loggingIn = false;
            return;
        }

        switch ($loginMethod) {
            case LoginMethod.Local:
                await handleLocalLogin();
                break;
            case LoginMethod.Bunker:
                await handleBunkerLogin();
                break;
            case LoginMethod.Nip07:
                await handleNip07Login();
                break;
        }
    }

    async function handleLocalLogin() {
        // We either get the private key from sessionStorage or decrypt from localStorage
        if ($sessionPK) {
            $ndk.signer = new NDKPrivateKeySigner($sessionPK);
            $loggingIn = false;

            await initializeUser($ndk);
        } else {
            showDecryptSecretModal = true;
        }
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

    async function handleBunkerLogin() {
        const localBunkerKey = localStorage.getItem('bunkerLocalSignerPK');
        const bunkerUrl = localStorage.getItem('bunkerUrl');
        const bunkerRelayURLsString = localStorage.getItem('bunkerRelayURLs');

        if (!localBunkerKey || !bunkerRelayURLsString || !bunkerUrl) {
            return;
        }

        const bunkerRelayURLs = bunkerRelayURLsString.split(',');

        setupBunkerTimeout();

        console.log('bunker relays:', bunkerRelayURLs)
        console.log('bunkerndk connected relays', $bunkerNDK.pool);
        // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
        bunkerRelayURLs.forEach((url) => {
            const relay = $bunkerNDK.addExplicitRelay(url)
            $bunkerNDK.pool.on('relay:ready', async (r: NDKRelay) => {
                if ($bunkerRelayConnected) {
                    console.info(
                        'A bunker relay already connected, init bunker NOT necessary'
                    );
                    return;
                }
                $bunkerRelayConnected = true;
                console.info(`Bunker relay ${r.url} READY, connect Bunker...`)
                try {
                    const localSigner = new NDKPrivateKeySigner(localBunkerKey);
                    const remoteSigner = new NDKNip46Signer(
                        $bunkerNDK, bunkerUrl, localSigner
                    );

                    const returnedUser = await remoteSigner.blockUntilReady();
                    console.info('Bunker connected! Logging in...')
                    if (returnedUser.npub) {
                        $ndk.signer = remoteSigner;
                        await initializeUser($ndk);
                        $loggingIn = false;
                    }
                } catch (e) {
                    showBunkerConnectionError(e);
                }
            })
        });
        $bunkerNDK.connect();
    }

    function setupBunkerTimeout() {
        setTimeout(() => {
            if (!$ndk.signer) {
                toaster.warning({
                    title: 'Bunker connection took too long!',
                    description: 'Fix or Remove Bunker Connection!',
                    duration: 60000, // 1 min
                    action: {
                        label: 'Logout',
                        onClick: () => {
                            $loggingIn = false;
                            logout();
                        },
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

    async function handleNip07Login() {
        if (!$ndk.signer) {
            $ndk.signer = new NDKNip07Signer();
            await initializeUser($ndk);
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
            console.log('logging in user');
            await restoreLogin();
        }
        console.log('Session initialized!');

        sessionInitialized.set(true);
    });

    onDestroy(() => {
        console.log('layout on destroy');

        if (followSubscription) followSubscription.stop();

        if (allJobs) allJobs.empty();
        if (allBids) allBids.empty();
        if (myJobs) myJobs.empty();
        if (myBids) myBids.empty();

        if (messageStore) messageStore.empty();
        if (allReceivedZaps) allReceivedZaps.empty();
        if (allReviews) allReviews.empty();
    });

    // Check for app updates and bid reload option to user in a Toast
    $effect(() => {
        if ($updated) {
            toaster.info({
                title: 'New version of the app is available!',
                duration: 60_000,
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
        if ($wotFilteredJobs && $myBids) {
            // console.log('all jobs change:', $wotFilteredJobs)
            $wotFilteredJobs.forEach((t: JobEvent) => {
                $myBids.forEach((o: BidEvent) => {
                    if (o.referencedJobDTag === t.dTag) {
                        // If users bid won send that else just send relevant job
                        if (t.acceptedBidAddress === o.bidAddress) {
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
        if ($wotFilteredBids && $myJobs) {
            // console.log('all bids change:', $wotFilteredBids)
            $wotFilteredBids.forEach((o: BidEvent) => {
                $myJobs.forEach((t: JobEvent) => {
                    if (o.referencedJobDTag === t.dTag) {
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
                $myJobs.forEach((t: JobEvent) => {
                    if (t.jobAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($freelancerReviews) {
            $freelancerReviews.forEach((r: ReviewEvent) => {
                $myBids.forEach((o: BidEvent) => {
                    if (o.bidAddress === r.reviewedEventAddress) {
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
                        '#k': [NDKKind.FreelanceJob.toString(), NDKKind.FreelanceBid.toString()],
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
<div
    class="w-full h-full flex flex-col"
>
    <header
        class="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-brightGray"
        aria-label="Main header"
    >
        <Header onRestoreLogin={restoreLogin} />
    </header>

    <!-- Content Area -->
    <div class="mt-[65px] flex-auto w-full h-full flex">
        <!-- Collapsible Sidebar (hidden on small screens) -->
        {#if displayNav}
            <SidebarLeft />
        {/if}

        <!-- Main Content  -->
        <main class="sm:ml-[96px] flex-1" aria-label="Main content">
            {@render children?.()}
            {#if !(page.url.pathname.includes('messages/naddr'))}
                <div
                    style={`height: ${footerHeight}px;`}
                >
                </div>
            {/if}
        </main>
    </div>

    <!-- Mobile Footer  -->
    {#if displayFooter}
        <footer
            class="fixed bottom-0 w-full sm:hidden z-10"
            aria-label="Mobile navigation"
            bind:offsetHeight={footerHeight}
        >
            <Footer />
        </footer>
    {/if}
</div>

<DecryptSecretModal bind:isOpen={showDecryptSecretModal} callback={decryptSecretModalCallback} />

<!-- Job Post Success Modal -->
{#if $jobPostSuccessState.showModal && $jobPostSuccessState.jobData}
    <JobPostSuccess
        bind:isOpen={$jobPostSuccessState.showModal}
        job={$jobPostSuccessState.jobData}
    />
{/if}

<!-- Modal to display after bid is accepted -->
{#if $bidTakenState.showModal && $bidTakenState.jobId}
    <BidTakenModal bind:isOpen={$bidTakenState.showModal} jobId={$bidTakenState.jobId} />
{/if}
