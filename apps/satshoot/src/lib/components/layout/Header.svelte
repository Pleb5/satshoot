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
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import { filterAndRelaySetFromBech32, NDKKind, NDKRelaySet, NDKSubscriptionCacheUsage, profileFromEvent, type NDKEvent } from '@nostr-dev-kit/ndk';
    import ndk, { BOOTSTRAPOUTBOXRELAYS, DEFAULTRELAYURLS } from '$lib/stores/session';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import AppMenu from './AppMenu.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { page } from '$app/state';
    import { beforeNavigate, goto } from '$app/navigation';
    import { onDestroy, onMount } from 'svelte';
    import LogoutModal from '../Modals/LogoutModal.svelte';
    import { idFromNaddr, isFreelanceJobOrServiceURI, isNpubOrNprofile, getPubkeyFromNpubOrNprofile } from '$lib/utils/nip19';
    import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';

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
    
    // State for freelance naddr search results
    let searchingFreelanceNaddr = $state(false);
    let freelanceEvent = $state<NDKEvent | null>(null);
    let showFreelanceNaddrResult = $state(false);
    let freelanceNaddrError = $state(false);
    
    // State for profile search results
    let searchingProfile = $state(false);
    let profilePubkey = $state<string | null>(null);
    let userProfile = $state<NDKUserProfile | null>(null);
    let showProfileResult = $state(false);
    let profileError = $state(false);

    let debounceTimer = $state<NodeJS.Timeout | null>(null);
    let previousSearchInput = $state('');
    let previousPath = $state('');

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';

    function handleSearch() {
        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        let trimmedSearchInput = searchInput.trim();
        if (trimmedSearchInput.startsWith("nostr:")) {
            trimmedSearchInput = trimmedSearchInput.replace("nostr:", "")
        } 
        
        // Check if it's a freelance event
        if (isFreelanceJobOrServiceURI(trimmedSearchInput)) {
            handleFreelanceNaddrSearch(trimmedSearchInput);
            return;
        }
        
        // Check if it's an npub or nprofile
        if (isNpubOrNprofile(trimmedSearchInput)) {
            handleProfileSearch(trimmedSearchInput);
            return;
        }

        // Hide all search results if showing
        showFreelanceNaddrResult = false;
        freelanceEvent = null;
        showProfileResult = false;
        userProfile = null;

        // Set a new timer for regular search
        debounceTimer = setTimeout(() => {
            const url = new URL(page.url);

            if (trimmedSearchInput) {
                url.searchParams.set('searchQuery', trimmedSearchInput);
            } else {
                url.searchParams.delete('searchQuery');
            }

            goto(url.toString(), { replaceState: true, keepFocus: true });
        }, 300); // 300ms debounce delay
    }

    async function handleFreelanceNaddrSearch(naddrString: string) {
        searchingFreelanceNaddr = true;
        freelanceNaddrError = false;
        freelanceEvent = null;
        showFreelanceNaddrResult = true;

        try {
            const id = idFromNaddr(naddrString)
            const relays = filterAndRelaySetFromBech32(naddrString, $ndk).relaySet

            const event = await $ndk.fetchEvent(
                id,
                {cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST},
                relays
            )

            freelanceEvent = event;
            if (event) 
                freelanceNaddrError = false;
        } catch (error) {
            console.error('Error fetching freelance naddr:', error);
            freelanceNaddrError = true;
        } finally {
            searchingFreelanceNaddr = false;
        }
    }

    async function handleProfileSearch(identifier: string) {
        searchingProfile = true;
        profileError = false;
        userProfile = null;
        profilePubkey = null;
        showProfileResult = true;

        try {
            const pubkey = getPubkeyFromNpubOrNprofile(identifier);
            if (!pubkey) {
                profileError = true;
                return;
            }

            profilePubkey = pubkey;

            // Fetch user metadata
            const metadataFilter = {
                kinds: [NDKKind.Metadata],
                authors: [pubkey],
            };

            const profileEvent = await fetchEventFromRelaysFirst(metadataFilter, {
                relayTimeoutMS: 3000,
                fallbackToCache: true,
            });

            if (profileEvent) {
                userProfile = profileFromEvent(profileEvent);
            } else {
                // If no profile found, we'll still show the result with default avatar
                userProfile = null;
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            profileError = true;
        } finally {
            searchingProfile = false;
        }
    }

    function clearSearch() {
        searchInput = '';
        previousSearchInput = ''; // Update previousSearchInput to prevent effect re-trigger
        // Clear freelance naddr results
        showFreelanceNaddrResult = false;
        freelanceEvent = null;
        freelanceNaddrError = false;
        // Clear profile results
        showProfileResult = false;
        userProfile = null;
        profilePubkey = null;
        profileError = false;
        // Get the current query parameters
        const url = new URL(page.url);
        // delete search query param
        url.searchParams.delete('searchQuery');
        // Navigate to the updated
        goto(url.toString(), { replaceState: true, keepFocus: true });
    }

    function closeFreelanceNaddrResult() {
        showFreelanceNaddrResult = false;
    }

    function closeProfileResult() {
        showProfileResult = false;
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && !searchContainer.contains(target)) {
            closeFreelanceNaddrResult();
            closeProfileResult();
        }
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

    $effect(() => {
        // Only trigger if searchInput has actually changed
        if (searchInput !== previousSearchInput) {
            previousSearchInput = searchInput;
            if (searchInput) {
                handleSearch();
            } else if (searchInput === '' && page.url.searchParams.has('searchQuery')) {
                // Only clear URL params if search was cleared and we have searchQuery param
                const url = new URL(page.url);
                url.searchParams.delete('searchQuery');
                goto(url.toString(), { replaceState: true, keepFocus: true });
            }
        }
    })

    // Close search results when navigating to a different path
    $effect(() => {
        if (page.url.pathname !== previousPath) {
            previousPath = page.url.pathname;
            
            // Clear search dropdown if open
            if (showFreelanceNaddrResult) {
                closeFreelanceNaddrResult();
            }
            if (showProfileResult) {
                closeProfileResult();
            }
            
            // Clear search input and URL param if search is active
            if (searchInput || page.url.searchParams.has('searchQuery')) {
                // Update both searchInput and previousSearchInput to prevent effect re-trigger
                searchInput = '';
                previousSearchInput = '';
                
                // Clear freelance naddr results
                showFreelanceNaddrResult = false;
                freelanceEvent = null;
                freelanceNaddrError = false;
                
                // Clear profile results
                showProfileResult = false;
                userProfile = null;
                profilePubkey = null;
                profileError = false;
                
                // Clear URL search param if it exists
                if (page.url.searchParams.has('searchQuery')) {
                    const url = new URL(page.url);
                    url.searchParams.delete('searchQuery');
                    goto(url.toString(), { replaceState: true, keepFocus: true });
                }
            }
        }
    })

    onMount(() => {
        const searchQueryParam = page.url.searchParams.get('searchQuery');
        if (searchQueryParam) {
            searchInput = searchQueryParam;
            previousSearchInput = searchQueryParam; // Set previous to avoid triggering effect
        }
        
        // Initialize previousPath
        previousPath = page.url.pathname;
        
        // Add click outside listener
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
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
                                <div class="relative hidden sm:block search-container">
                                    <Input
                                        bind:value={searchInput}
                                        placeholder="search"
                                        type="search"
                                        autocomplete={null}
                                        autocapitalize="off"
                                        autocorrect="off"
                                        spellcheck={false}
                                        name="search-satshoot"
                                        id="search-satshoot"
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
                                    
                                    <!-- Freelance Naddr Search Results Dropdown -->
                                    {#if showFreelanceNaddrResult}
                                        <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                            {#if searchingFreelanceNaddr}
                                                <div class="flex items-center justify-center py-4">
                                                    <ProgressRing size={8} />
                                                    <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching...</span>
                                                </div>
                                            {:else if freelanceNaddrError || !freelanceEvent}
                                                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                    <i class="bx bx-search-alt text-2xl mb-2"></i>
                                                    <p class="text-sm">Nothing Found</p>
                                                </div>
                                            {:else}
                                                <div class="flex gap-x-4">
                                                    <a class="w-full link" href={'/' + freelanceEvent.encode()}>
                                                        <h4>{freelanceEvent.tagValue("title")}</h4>
                                                    </a>
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                    
                                    <!-- Profile Search Results Dropdown -->
                                    {#if showProfileResult}
                                        <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                            {#if searchingProfile}
                                                <div class="flex items-center justify-center py-4">
                                                    <ProgressRing size={8} />
                                                    <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching...</span>
                                                </div>
                                            {:else if profileError || !profilePubkey}
                                                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                    <i class="bx bx-user-x text-2xl mb-2"></i>
                                                    <p class="text-sm">Profile Not Found</p>
                                                </div>
                                            {:else}
                                                <a class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" href={'/' + nip19.npubEncode(profilePubkey)}>
                                                    <img 
                                                        src={userProfile?.picture || getRoboHashPicture(profilePubkey)} 
                                                        alt="Profile" 
                                                        class="w-12 h-12 rounded-full object-cover"
                                                    />
                                                    <div class="flex flex-col">
                                                        <span class="font-medium text-gray-900 dark:text-gray-100">
                                                            {userProfile?.name || userProfile?.displayName || 'Anonymous'}
                                                        </span>
                                                        {#if userProfile?.nip05}
                                                            <span class="text-sm text-gray-600 dark:text-gray-400">
                                                                {userProfile.nip05}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                </a>
                                            {/if}
                                        </div>
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

                                <button onclick={() => (showAppMenu = !showAppMenu)}>
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
                            class="flex flex-row grow gap-4 items-center justify-evenly sm:hidden py-[10px] search-container"
                        >
                            <Button variant="outlined" onClick={() => (displaySearchInput = false)}>
                                <i class="bx bx-chevron-left text-xl"></i>
                            </Button>
                            <div class="relative flex-1">
                                <Input
                                    bind:value={searchInput}
                                    placeholder="search"
                                    type="text"
                                    autocomplete={null}
                                    autocapitalize="off"
                                    autocorrect="off"
                                    spellcheck={false}
                                    data-form-type="other"
                                    data-lpignore="true"
                                    name="search-satshoot-mobile"
                                    id="search-satshoot-mobile"
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
                                
                                <!-- Freelance Naddr Search Results Dropdown (Mobile) -->
                                {#if showFreelanceNaddrResult}
                                    <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                        {#if searchingFreelanceNaddr}
                                            <div class="flex items-center justify-center py-4">
                                                <ProgressRing size={8} />
                                                <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching...</span>
                                            </div>
                                        {:else if freelanceNaddrError || !freelanceEvent}
                                            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                <i class="bx bx-search-alt text-2xl mb-2"></i>
                                                <p class="text-sm">Nothing Found</p>
                                            </div>
                                        {:else}
                                            <div class="flex gap-x-4">
                                                <a class="w-full link" href={'/' + freelanceEvent.encode()}>
                                                    <h4>{freelanceEvent.tagValue("title")}</h4>
                                                </a>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                                
                                <!-- Profile Search Results Dropdown (Mobile) -->
                                {#if showProfileResult}
                                    <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                        {#if searchingProfile}
                                            <div class="flex items-center justify-center py-4">
                                                <ProgressRing size={8} />
                                                <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching...</span>
                                            </div>
                                        {:else if profileError || !profilePubkey}
                                            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                <i class="bx bx-user-x text-2xl mb-2"></i>
                                                <p class="text-sm">Profile Not Found</p>
                                            </div>
                                        {:else}
                                            <a class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" href={'/' + nip19.npubEncode(profilePubkey)}>
                                                <img 
                                                    src={userProfile?.picture || getRoboHashPicture(profilePubkey)} 
                                                    alt="Profile" 
                                                    class="w-10 h-10 rounded-full object-cover"
                                                />
                                                <div class="flex flex-col">
                                                    <span class="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                                        {userProfile?.name || userProfile?.displayName || 'Anonymous'}
                                                    </span>
                                                    {#if userProfile?.nip05}
                                                        <span class="text-xs text-gray-600 dark:text-gray-400">
                                                            {userProfile.nip05}
                                                        </span>
                                                    {/if}
                                                </div>
                                            </a>
                                        {/if}
                                    </div>
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
