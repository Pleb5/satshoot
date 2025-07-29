<script lang="ts">
    import '../app.css';

    // Font awesome
    import '@fortawesome/fontawesome-free/css/brands.css';
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
    import '@fortawesome/fontawesome-free/css/solid.css';

    import ndk, {
        bunkerNDK,
        bunkerRelayConnected,
        sessionInitialized,
        sessionPK,
    } from '$lib/stores/session';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

    import { Dexie } from 'dexie';

    import { updated, pollUpdated } from '$lib/stores/app-updated';
    import { online, retriesLeft } from '$lib/stores/network';
    import currentUser, {
        currentUserFreelanceFollows,
        loggedIn,
        loggingIn,
        loginMethod,
        mounted,
        UserMode,
        userMode,
    } from '$lib/stores/user';

    import {
        allBids,
        allJobs,
        allOrders,
        allServices,
        myBids,
        myJobs,
        myOrders,
        myServices,
        wotFilteredBids,
        wotFilteredJobs,
        wotFilteredOrders,
        wotFilteredServices,
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
    import { JobStatus, type JobEvent } from '$lib/events/JobEvent';

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
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderStatus, type OrderEvent } from '$lib/events/OrderEvent';
    import { browser } from '$app/environment';

    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();

    let showDecryptSecretModal = $state(false);

    const displayNav = $derived($loggedIn);
    const hideBottomNav = $derived(
        page.route.id === '/messages/[jobId=event]' ||
            page.route.id === '/messages/[serviceId=service]'
    );
    const displayFooter = $derived(displayNav && !hideBottomNav);
    let footerHeight = $state(0);
    let followSubscription = $state<NDKSubscription>();

    let currentMode: string | null = null;
    $effect(() => {
        if (page.url.pathname==='/') {
            console.log('setting dark mode for LP')
            currentMode = document.documentElement.getAttribute('data-mode');
            document.documentElement.setAttribute('data-mode', 'dark');
        } else if (currentMode) {
            console.log('setting back mode to original')
            document.documentElement.setAttribute('data-mode', currentMode);
        }
    })

    $effect(() => {
        if ($retriesLeft === 0) {
            toaster.warning({
                title: 'Could not connect to Relays!',
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

        console.log('bunker relays:', bunkerRelayURLs);
        console.log('bunkerndk connected relays', $bunkerNDK.pool);
        // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
        bunkerRelayURLs.forEach((url) => {
            const relay = $bunkerNDK.addExplicitRelay(url);
            $bunkerNDK.pool.on('relay:ready', async (r: NDKRelay) => {
                if ($bunkerRelayConnected) {
                    console.info('A bunker relay already connected, init bunker NOT necessary');
                    return;
                }
                $bunkerRelayConnected = true;
                console.info(`Bunker relay ${r.url} READY, connect Bunker...`);
                try {
                    const localSigner = new NDKPrivateKeySigner(localBunkerKey);
                    const remoteSigner = new NDKNip46Signer($bunkerNDK, bunkerUrl, localSigner);

                    const returnedUser = await remoteSigner.blockUntilReady();
                    console.info('Bunker connected! Logging in...');
                    if (returnedUser.npub) {
                        $ndk.signer = remoteSigner;
                        await initializeUser($ndk);
                        $loggingIn = false;
                    }
                } catch (e) {
                    showBunkerConnectionError(e);
                }
            });
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
        const mode = getModeUserPrefers()
            || document.documentElement.getAttribute('data-mode');
        if (!mode) {
            setModeUserPrefers('dark');
            document.documentElement.setAttribute('data-mode', 'dark');
        } else if (page.url.pathname !== '/') {
            document.documentElement.setAttribute('data-mode', mode);
        }

        // window.addEventListener('beforeinstallprompt', (e) => {
        //     e.preventDefault();
        //     deferredInstallPrompt = e;
        //     showAppInstallPromotion = true;
        // });

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
        if (allServices) allServices.empty();
        if (allOrders) allOrders.empty();

        if (myJobs) myJobs.empty();
        if (myBids) myBids.empty();
        if (myServices) myServices.empty();
        if (myOrders) myOrders.empty();

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
    let deferredInstallPrompt = $state<any>(); // BeforeInstallPromptEvent is not available in TypeScript by default
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

    // when a job is posted by a user whom current user is freelance following
    $effect(() => {
        if ($currentUser && $userMode === UserMode.Freelancer) {
            $wotFilteredJobs.forEach((job: JobEvent) => {
                if (job.status === JobStatus.New && $currentUserFreelanceFollows.has(job.pubkey)) {
                    sendNotification(job);
                }
            });
        }
    });

    // when user have won or lost the bid on the job
    $effect(() => {
        if ($wotFilteredJobs && $myBids) {
            $wotFilteredJobs.forEach((job: JobEvent) => {
                if (job.status === JobStatus.InProgress) {
                    $myBids.forEach((bid) => {
                        if (bid.referencedJobDTag === job.dTag) {
                            sendNotification(bid);
                        }
                    });
                }
            });
        }
    });

    // when the job is completed (resolved or failed)
    $effect(() => {
        if ($wotFilteredJobs && $myBids && $currentUser) {
            $wotFilteredJobs.forEach((job: JobEvent) => {
                if (job.isClosed() && job.winnerFreelancer === $currentUser.pubkey) {
                    $myBids.forEach((bid) => {
                        if (bid.referencedJobDTag === job.dTag) {
                            sendNotification(bid);
                        }
                    });
                }
            });
        }
    });

    // when a bid is placed on current user's job which is in new state
    $effect(() => {
        if ($wotFilteredBids && $myJobs) {
            $myJobs.forEach((job: JobEvent) => {
                if (job.status !== JobStatus.New) return;

                $wotFilteredBids.forEach((bid: BidEvent) => {
                    if (bid.referencedJobDTag === job.dTag) {
                        sendNotification(bid);
                    }
                });
            });
        }
    });

    // when order is placed on my service
    $effect(() => {
        if ($wotFilteredOrders && $myServices) {
            $wotFilteredOrders.forEach((o: OrderEvent) => {
                $myServices.forEach((s: ServiceEvent) => {
                    if (
                        o.referencedServiceAddress === s.serviceAddress &&
                        o.status === OrderStatus.Open &&
                        !s.orders.includes(o.orderAddress)
                    ) {
                        sendNotification(o);
                    }
                });
            });
        }
    });

    // when my order is accepted
    $effect(() => {
        if ($wotFilteredServices && $myOrders) {
            $wotFilteredServices.forEach((s: ServiceEvent) => {
                $myOrders.forEach((o: OrderEvent) => {
                    if (
                        o.referencedServiceAddress === s.serviceAddress &&
                        o.status === OrderStatus.Open &&
                        s.orders.includes(o.orderAddress)
                    ) {
                        sendNotification(o);
                    }
                });
            });
        }
    });

    // when order is closed associated with my service
    $effect(() => {
        if ($wotFilteredOrders && $myServices) {
            $wotFilteredOrders.forEach((o: OrderEvent) => {
                $myServices.forEach((s: ServiceEvent) => {
                    if (
                        o.referencedServiceAddress === s.serviceAddress &&
                        o.status !== OrderStatus.Open
                    ) {
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
                $myJobs.forEach((job: JobEvent) => {
                    if (job.jobAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($freelancerReviews) {
            $freelancerReviews.forEach((r: ReviewEvent) => {
                $myBids.forEach((bid: BidEvent) => {
                    if (bid.bidAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($clientReviews) {
            $clientReviews.forEach((r: ReviewEvent) => {
                $myOrders.forEach((order) => {
                    if (order.orderAddress === r.reviewedEventAddress) {
                        sendNotification(r);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($freelancerReviews) {
            $freelancerReviews.forEach((r: ReviewEvent) => {
                $myServices.forEach((service) => {
                    if (service.serviceAddress === r.reviewedEventAddress) {
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
                        kinds: [NDKKind.FollowSet],
                        '#p': [$currentUser.pubkey],
                        '#d': ['freelance'],
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
<div class="w-full h-full flex flex-col">
    {#if displayNav}
        <header
            class="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-brightGray"
            aria-label="Main header"
        >
            <Header onRestoreLogin={restoreLogin} />
        </header>
    {/if}

    <div class="flex {displayNav ? 'mt-[65px]' : ''} ">
        <!-- Collapsible Sidebar (hidden on small screens) -->
        {#if displayNav}
            <SidebarLeft />
        {/if}

        <!-- Content Area -->
        <div class="flex-auto w-full h-full flex">

            <!-- Main Content  -->
            <main class="flex-1" aria-label="Main content">
                {@render children?.()}
                {#if !page.url.pathname.includes('messages/naddr')}
                    <div style={`height: ${footerHeight}px;`}></div>
                {/if}
            </main>
        </div>
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
