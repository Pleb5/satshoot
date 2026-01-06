<script lang="ts">
    import '../app.css';

    // Font awesome
    import '@fortawesome/fontawesome-free/css/brands.css';
    import '@fortawesome/fontawesome-free/css/fontawesome.css';
    import '@fortawesome/fontawesome-free/css/regular.css';
    import '@fortawesome/fontawesome-free/css/solid.css';

    import ndk, {
        BLACKLISTED_RELAYS,
        discoveredRelays,
        sessionInitialized,
        sessionPK,
    } from '$lib/stores/session';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
    import NDK from '@nostr-dev-kit/ndk';

    import { Dexie } from 'dexie';

    import { updated, pollUpdated } from '$lib/stores/app-updated';
    import { online, retriesLeft } from '$lib/stores/network';
    import currentUser, {
        currentUserFreelanceFollows,
        loggedIn,
        loggingIn,
        loginMethod,
        mounted,
        onBoarding,
        UserMode,
        userMode,
    } from '$lib/stores/user';

    import { myMuteList } from '$lib/stores/wot';

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

    import { messageStore, filteredMessages } from '$lib/stores/messages';
    import { sendNotification } from '$lib/stores/notifications';
    import { allReviews, clientReviews, freelancerReviews } from '$lib/stores/reviews';
    import { allReceivedZaps, filteredReceivedZaps } from '$lib/stores/zaps';

    import { checkRelayConnections, initializeUser, logout } from '$lib/utils/helpers';

    import { wotUpdateFailed } from '$lib/stores/wot';

    import { LoginMethod, RestoreMethod } from '$lib/stores/session';

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
    import { getModeUserPrefers, setModeUserPrefers } from '$lib/utils/lightSwitch';
    import {
        jobPostSuccessState,
        bidTakenState,
        showLoginModal,
        showLogoutModal,
        showDecentralizedDiscoveryModal,
    } from '$lib/stores/modals';
    import JobPostSuccess from '$lib/components/Modals/JobPostSuccess.svelte';
    import BidTakenModal from '$lib/components/Modals/BidTakenModal.svelte';
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { type OrderEvent } from '$lib/events/OrderEvent';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import LogoutModal from '$lib/components/Modals/LogoutModal.svelte';
    import DecentralizedDiscoveryModal from '$lib/components/Modals/DecentralizedDiscoveryModal.svelte';

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

    $effect(() => {
        if ($retriesLeft === 0) {
            toaster.warning({
                title: 'Could not connect to Relays!',
                duration: 60000, // 1 min
                action: {
                    label: 'Check relays',
                    onClick: () => {
                        goto('/settings/app-relays');
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
        console.log('logging in user');
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
            case LoginMethod.Nip46:
                await handleNip46Login();
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
            console.log('Start init session in local key login');
            initializeUser($ndk);
        } else if (localStorage.getItem('nostr-nsec') !== null) {
            const storedSecret = localStorage.getItem('nostr-nsec');

            if (storedSecret && storedSecret.startsWith('nsec')) {
                const privateKey = privateKeyFromNsec(storedSecret);
                if (privateKey) {
                    $ndk.signer = new NDKPrivateKeySigner(privateKey);
                    $sessionPK = privateKey;
                    $loggingIn = false;
                    initializeUser($ndk);
                    return;
                }
            }

            showDecryptSecretModal = true;
        } else {
            $loggingIn = false;
            $loggedIn = false;
            $loginMethod = null;
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

    function setupNip46Timeout() {
        return setTimeout(() => {
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

    function showNip46Error(error: any) {
        toaster.error({
            title: 'Could not restore remote signer session!',
            description: `Reason: ${error}`,
            duration: 60000, // 1 min
        });
    }

    async function handleNip46Login() {
        const signerPayload = localStorage.getItem('nip46SignerPayload');

        if (!signerPayload) {
            console.log('No nip46SignerPayload found in localStorage');
            $loggingIn = false;
            return;
        }

        const timeoutId = setupNip46Timeout();

        try {
            console.log('Attempting remote signer restoration...');

            // Parse relay URLs from the signer payload
            const parsedPayload = JSON.parse(signerPayload);
            const relayUrls = (parsedPayload?.payload?.relayUrls || []) as string[];

            if (relayUrls.length === 0) {
                throw new Error('No relay URLs found in signer payload');
            }

            // Create a fresh ndk instance for restoration
            const remoteSignerNDK = new NDK({
                enableOutboxModel: false,
                explicitRelayUrls: relayUrls,
            });

            // Connect to relays first
            console.log('Connecting to bunker relays...');
            await remoteSignerNDK.connect();

            // Wait for relay connections with better event handling
            console.log('Waiting for relay connections to stabilize...');
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                const connectedRelays = remoteSignerNDK.pool.connectedRelays();
                console.log(
                    `Attempt ${attempts + 1}: Connected bunker relays: ${connectedRelays.length}`
                );

                if (connectedRelays.length > 0) {
                    console.log('At least one relay connected, proceeding with restoration');
                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, 500));
                attempts++;
            }

            const finalConnectedRelays = remoteSignerNDK.pool.connectedRelays();
            console.log('Final connected bunker relays:', finalConnectedRelays.length);

            if (finalConnectedRelays.length === 0) {
                throw new Error(
                    'No remote signer relays connected after multiple attempts. Check your internet connection and relay availability.'
                );
            }

            // Use NDK's built-in restoration method with timeout
            console.log('Attempting signer restoration with payload...');

            const restoredSigner = await NDKNip46Signer.fromPayload(signerPayload, remoteSignerNDK);

            // remove secret from restored signer, we don't need it
            // it was only needed for login not for the restoration process
            restoredSigner.secret = null;

            console.log('Testing restored signer connection...');

            const user = await restoredSigner.blockUntilReady();

            if (!user.npub) {
                throw new Error('Failed to restore remote signer session - no user returned');
            }

            // Connection restored successfully
            $ndk.signer = restoredSigner;
            console.log('Remote signer session restored successfully');
            // Initialize user and complete login
            await initializeUser($ndk);
        } catch (error) {
            console.error('Remote signer restoration failed:', error);

            // Provide more specific error context
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;

                // Add helpful context for common bunker issues
                if (errorMessage.includes('No bunker relays connected')) {
                    errorMessage +=
                        '\n\nTip: Make sure you have a stable internet connection and that the bunker relays are online.';
                } else if (errorMessage.includes('blockUntilReady')) {
                    errorMessage +=
                        '\n\nTip: The bunker might be offline or busy. Try again in a few moments.';
                } else if (errorMessage.includes('fromPayload')) {
                    errorMessage +=
                        '\n\nTip: Your stored credentials might be corrupted. Try logging in again.';
                }
            }

            showNip46Error(errorMessage);

            $loggingIn = false;
        } finally {
            clearTimeout(timeoutId);
            $loggingIn = false;
        }
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
        const mode = getModeUserPrefers() || document.documentElement.getAttribute('data-mode') || 'light';
        document.documentElement.setAttribute('data-mode', mode);
        setModeUserPrefers(mode);

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
        // Start polling for app updates
        pollUpdated();

        $mounted = true;
        // Setup client-side caching
        if (!$ndk.cacheAdapter) {
            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });
        }

        // if user leaves the app during onboarding and comes back later
        // redirect the user to on boarding flow
        if ($onBoarding) {
            goto('/letsgo');
        }

        configureBasics();

        try {
            await $ndk.connect(2500);
        } catch(e){
            console.warn('NDK initial connect error:', e);
        } finally {
            if (!$loggedIn) {
                await restoreLogin();
            }

            sessionInitialized.set(true);
        }
    });

    onDestroy(() => {
        if (followSubscription) followSubscription.stop();

        if (myMuteList) myMuteList.empty();

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

    $effect(() => {
        if ($sessionInitialized && $ndk) {
            $discoveredRelays.forEach((relay) => {
                if (BLACKLISTED_RELAYS.has(relay.trim())) return;
                if (!$ndk.explicitRelayUrls.includes(relay)) {
                    $ndk.addExplicitRelay(relay, undefined, true);
                }
            });
        }
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
                // no need to send notification for own job
                if (
                    job.pubkey !== $currentUser.pubkey &&
                    $currentUserFreelanceFollows.has(job.pubkey)
                ) {
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

    // when a bid is placed on current user's job
    $effect(() => {
        if ($wotFilteredBids && $myJobs && $userMode === UserMode.Client) {
            $myJobs.forEach((job: JobEvent) => {
                $wotFilteredBids.forEach((bid: BidEvent) => {
                    if (bid.referencedJobDTag === job.dTag) {
                        sendNotification(bid);
                    }
                });
            });
        }
    });

    // when there's an order on my service
    $effect(() => {
        if ($wotFilteredOrders && $myServices) {
            $wotFilteredOrders.forEach((o: OrderEvent) => {
                $myServices.forEach((s: ServiceEvent) => {
                    if (o.referencedServiceAddress === s.serviceAddress) {
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
                    if (o.referencedServiceAddress === s.serviceAddress) {
                        sendNotification(o);
                    }
                });
            });
        }
    });

    $effect(() => {
        if ($filteredMessages && $currentUser) {
            $filteredMessages.forEach((dm: NDKEvent) => {
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
    {#if !$onBoarding}
        <header
            class="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-brightGray"
            aria-label="Main header"
        >
            <Header onRestoreLogin={restoreLogin} />
        </header>
    {/if}

    <!-- Collapsible Sidebar (hidden on small screens) -->
    {#if displayNav && !$onBoarding}
        <SidebarLeft />
    {/if}

    <!-- Content Area -->
    <div class="flex-auto w-full h-full flex {!$onBoarding ? 'mt-[65px]' : ''}">
        <!-- Main Content  -->
        <main
            class="{!$onBoarding && displayNav ? 'sm:ml-[96px]' : ''} flex-1"
            aria-label="Main content"
        >
            {@render children?.()}
            {#if !page.url.pathname.includes('messages/naddr')}
                <div style={`height: ${footerHeight}px;`}></div>
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

<!-- Login Modal -->
<LoginModal bind:isOpen={$showLoginModal} />

<!-- Logout Modal -->
<LogoutModal bind:isOpen={$showLogoutModal} />

<!-- Decentralized Discovery Modal -->
<DecentralizedDiscoveryModal bind:isOpen={$showDecentralizedDiscoveryModal} />
