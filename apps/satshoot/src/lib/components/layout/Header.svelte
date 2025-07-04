<script lang="ts">
    import { Avatar } from '@skeletonlabs/skeleton-svelte';

    import LoginModal from '../Modals/LoginModal.svelte';
    import currentUser, {
        loggedIn,
        loggingIn,
        loginMethod,
        UserMode,
        userMode,
    } from '$lib/stores/user';
    import Button from '../UI/Buttons/Button.svelte';
    import { getRoboHashPicture, logout } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import { NDKKind, NDKRelaySet, profileFromEvent } from '@nostr-dev-kit/ndk';
    import ndk, { BOOTSTRAPOUTBOXRELAYS, DEFAULTRELAYURLS } from '$lib/stores/session';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import AppMenu from './AppMenu.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { page } from '$app/state';
    import { beforeNavigate, goto } from '$app/navigation';
    import { onDestroy, onMount } from 'svelte';
    import LogoutModal from '../Modals/LogoutModal.svelte';

    interface Props {
        onRestoreLogin: () => void;
    }

    let { onRestoreLogin }: Props = $props();

    let showLoginModal = $state(false);
    let showLogoutModal = $state(false);
    let showAppMenu = $state(false);

    let profilePicture = $state('');
    let hasAttemptedProfileFetch = $state(false);

    let searchInput = $state('');
    let displaySearchInput = $state(false); // for mobile view

    let debounceTimer = $state<NodeJS.Timeout | null>(null);

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';

    function handleSearch() {
        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Set a new timer
        debounceTimer = setTimeout(() => {
            const url = new URL(page.url);

            if (searchInput.trim()) {
                url.searchParams.set('searchQuery', searchInput.trim());
            } else {
                url.searchParams.delete('searchQuery');
            }

            goto(url.toString(), { replaceState: true, keepFocus: true });
        }, 300); // 300ms debounce delay
    }

    function clearSearch() {
        searchInput = '';
        // Get the current query parameters
        const url = new URL(page.url);
        // delete search query param
        url.searchParams.delete('searchQuery');
        // Navigate to the updated
        goto(url.toString(), { replaceState: true, keepFocus: true });
    }

    // Only trigger profile fetch when logged in changes to true and we haven't attempted yet
    $effect(() => {
        if ($loggedIn && !hasAttemptedProfileFetch) {
            fetchUserProfile();
            hasAttemptedProfileFetch = true;
        } else if (!$loggedIn) {
            // Reset the flag when logged out, so we fetch again on next login
            hasAttemptedProfileFetch = false;
        }
    });

    onMount(() => {
        const searchQueryParam = page.url.searchParams.get('searchQuery');
        if (searchQueryParam) searchInput = searchQueryParam;
    });

    // Clean up timer on component destroy
    onDestroy(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
    });

    beforeNavigate(({ from, to }) => {
        const trimmedSearchInput = searchInput.trim();
        const searchQueryParam = to?.url.searchParams.get('searchQuery');

        if (trimmedSearchInput) {
            to?.url.searchParams.set('searchQuery', trimmedSearchInput);
        } else if (searchQueryParam) {
            searchInput = searchQueryParam;
        }
    });

    const fetchUserProfile = async () => {
        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [$currentUser!.pubkey],
        };

        const metadataRelays = [...BOOTSTRAPOUTBOXRELAYS, ...DEFAULTRELAYURLS];

        const profileEvent = await fetchEventFromRelaysFirst(metadataFilter, {
            relayTimeoutMS: 3000,
            fallbackToCache: true,
            explicitRelays: Array.from(NDKRelaySet.fromRelayUrls(metadataRelays, $ndk).relays),
        });

        if (profileEvent) {
            const profile = profileFromEvent(profileEvent);
            $currentUser!.profile = profile;
            profilePicture =
                profile?.picture ?? profile?.image ?? getRoboHashPicture($currentUser!.pubkey);
        } else {
            profilePicture = getRoboHashPicture($currentUser!.pubkey);
        }
    };

    function handleLogin() {
        showLoginModal = true;
    }

    const satShootLogoWrapperClass = 'flex flex-row items-center gap-4 ' + '';

    const satShootLogoClass =
        'flex flex-row justify-start items-center relative gap-4 text-[20px] ' +
        'font-[800] text-blue-500 hover:text-blue-600 hover:no-underline ' +
        'transition ease-in-out duration-[0.3s] w-full ';
</script>

<div class="w-full flex flex-col justify-center items-center gap-0">
    <div class="flex flex-col justify-center items-center w-full">
        <div
            class="w-full flex flex-col items-center border-b border-b-black-100 py-1 dark:border-b-white-100"
        >
            <div
                class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full flex flex-row gap-6">
                    {#if !displaySearchInput}
                        <!-- In mobile view when displaySearchInput is false, simply display normal header-->
                        <div class={satShootLogoWrapperClass}>
                            <a href="/" class={satShootLogoClass}>
                                <img
                                    src="/img/satshoot.svg"
                                    alt="Satshoot logo"
                                    class="w-full max-w-[45px]"
                                />
                                <p class="max-[576px]:hidden">SatShoot</p>
                            </a>
                        </div>
                        <div class="flex flex-row grow gap-4 justify-end items-center">
                            {#if $loggedIn}
                                <!-- search input in desktop view -->
                                <div class="relative hidden sm:block">
                                    <Input
                                        bind:value={searchInput}
                                        onKeyPress={handleSearch}
                                        placeholder="search"
                                    />
                                    {#if searchInput.length}
                                        <Button
                                            variant="text"
                                            onClick={clearSearch}
                                            classes="absolute top-0 bottom-0 right-0"
                                        >
                                            <i class="bx bx-x"></i>
                                        </Button>
                                    {/if}
                                </div>

                                <!-- a trigger for opening search input in mobile view -->
                                <div class="sm:hidden">
                                    <Button
                                        variant="outlined"
                                        onClick={() => (displaySearchInput = true)}
                                    >
                                        <i class="bx bx-search text-xl"></i>
                                    </Button>
                                </div>

                                {#if $userMode === UserMode.Client}
                                    <Button href="/post-job/">Submit Job</Button>
                                {:else if $userMode === UserMode.Freelancer}
                                    <Button href="/post-service/">Create Service</Button>
                                {/if}

                                <!-- User Avatar and trigger for user app menu  -->
                                <button onclick={() => (showAppMenu = !showAppMenu)}>
                                    <!-- Avatar image -->
                                    <Avatar
                                        classes="rounded-full border-white placeholder-white cursor-pointer"
                                        size="size-14"
                                        border="border-4 border-surface-300-600 hover:border-primary-500!"
                                        src={profilePicture ??
                                            getRoboHashPicture($currentUser?.pubkey ?? '')}
                                        name={$currentUser?.profile?.displayName ?? ''}
                                    />
                                </button>
                            {:else if $loggingIn}
                                <div class="flex items-center gap-x-2">
                                    <Button
                                        classes={extraClassesForLogoutBtn}
                                        onClick={() => (showLogoutModal = true)}
                                    >
                                        Logout
                                    </Button>
                                    <h3 class="h6 md:h3 font-bold">Logging in...</h3>
                                    <ProgressRing color="primary" size={12} />
                                </div>
                            {:else if $loginMethod === 'local'}
                                <Button onClick={onRestoreLogin}>Login</Button>
                            {:else}
                                <Button onClick={handleLogin}>Login</Button>
                            {/if}
                        </div>
                    {:else}
                        <!-- In mobile view when displaySearchInput is true, replace normal header with search input -->
                        <div
                            class="flex flex-row grow gap-4 items-center justify-evenly sm:hidden py-[10px]"
                        >
                            <Button variant="outlined" onClick={() => (displaySearchInput = false)}>
                                <i class="bx bx-chevron-left text-xl"></i>
                            </Button>
                            <div class="relative">
                                <Input
                                    bind:value={searchInput}
                                    onKeyPress={handleSearch}
                                    placeholder="search"
                                />
                                {#if searchInput.length}
                                    <Button
                                        variant="text"
                                        onClick={clearSearch}
                                        classes="absolute top-0 bottom-0 right-0"
                                    >
                                        <i class="bx bx-x"></i>
                                    </Button>
                                {/if}
                            </div>
                            <i class="bx bx-search text-2xl mt-[5px]"></i>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<AppMenu bind:isOpen={showAppMenu} />

<LoginModal bind:isOpen={showLoginModal} />
<LogoutModal bind:isOpen={showLogoutModal} />
