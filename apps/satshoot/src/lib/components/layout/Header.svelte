<script lang="ts">
    import Avatar from '$lib/components/Users/Avatar.svelte';
    import currentUser, {
        loggedIn,
        loggingIn,
        loginMethod,
        UserMode,
        userMode,
    } from '$lib/stores/user';
    import Button from '../UI/Buttons/Button.svelte';
    import { get } from 'svelte/store';

    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import type NDK from '@nostr-dev-kit/ndk';
    import {
        filterAndRelaySetFromBech32,
        NDKKind,
        NDKRelaySet,
        NDKSubscriptionCacheUsage,
        profileFromEvent,
        type Hexpubkey,
        type NDKEvent,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import ndk, { BOOTSTRAPOUTBOXRELAYS, DEFAULTRELAYURLS } from '$lib/stores/session';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import AppMenu from './AppMenu.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { page } from '$app/state';
    import { beforeNavigate, goto } from '$app/navigation';
    import { onDestroy, onMount } from 'svelte';
    import {
        getPubkeyFromNpubOrNprofile,
        idFromNaddr,
        isFreelanceJobOrServiceURI,
        isNpubOrNprofile,
    } from '$lib/utils/nip19';
    import { nip19 } from 'nostr-tools';
    import { showLoginModal, showLogoutModal } from '$lib/stores/modals';
    import {
        requestVertexProfileSearch,
        VERTEX_PROFILE_SEARCH_LIMIT,
        VERTEX_PROFILE_SEARCH_MIN_LENGTH,
        VERTEX_PROFILE_SEARCH_SORT,
        VERTEX_PROFILE_SEARCH_TIMEOUT_MS,
    } from '$lib/services/vertex/vertex-profile-search';
    
    interface Props {
        onRestoreLogin: () => void;
    }

    let { onRestoreLogin }: Props = $props();

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

    let searchingProfileNames = $state(false);
    let showProfileNameResult = $state(false);
    let profileNameSearchRequestId = $state(0);
    let profileNameQuery = $state('');
    let profileNameHasSearched = $state(false);
    let profileNameResults = $state<
        Array<{ pubkey: Hexpubkey; profile: NDKUserProfile | null }>
    >([]);
    let profileNameError = $state(false);

    let debounceTimer = $state<NodeJS.Timeout | null>(null);
    let previousSearchInput = $state('');
    let previousPath = $state('');

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';

    function handleSearch() {
        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        let trimmedSearchInput = searchInput.trim();
        if (trimmedSearchInput.startsWith('nostr:')) {
            trimmedSearchInput = trimmedSearchInput.replace('nostr:', '');
        }

        // Check if it's a freelance event
        if (isFreelanceJobOrServiceURI(trimmedSearchInput)) {
            resetProfileNameResults();
            handleFreelanceNaddrSearch(trimmedSearchInput);
            return;
        }

        // Check if it's an npub or nprofile
        if (isNpubOrNprofile(trimmedSearchInput)) {
            resetProfileNameResults();
            handleProfileSearch(trimmedSearchInput);
            return;
        }

        // Hide all search results if showing
        showFreelanceNaddrResult = false;
        freelanceEvent = null;
        showProfileResult = false;
        userProfile = null;

        const looksLikeBech32Entity =
            /^(npub1|nprofile1|naddr1|nevent1|note1|nsec1|nrelay1|nwc1)/i.test(trimmedSearchInput);

        if (looksLikeBech32Entity) {
            resetProfileNameResults();
        } else if (trimmedSearchInput.length >= VERTEX_PROFILE_SEARCH_MIN_LENGTH) {
            showProfileNameResult = true;
            profileNameQuery = trimmedSearchInput;
            profileNameHasSearched = false;
            searchingProfileNames = false;
            profileNameError = false;
            profileNameResults = [];
        } else {
            resetProfileNameResults();
        }


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

    function resetProfileNameResults() {
        searchingProfileNames = false;
        showProfileNameResult = false;
        profileNameQuery = '';
        profileNameHasSearched = false;
        profileNameResults = [];
        profileNameError = false;
        profileNameSearchRequestId += 1;
    }

    async function handleProfileNameSearch(searchTerm: string) {
        if (!$currentUser) {
            resetProfileNameResults();
            return;
        }

        const trimmedSearchTerm = searchTerm.trim();
        if (trimmedSearchTerm.length < VERTEX_PROFILE_SEARCH_MIN_LENGTH) {
            resetProfileNameResults();
            return;
        }

        showProfileNameResult = true;
        profileNameQuery = trimmedSearchTerm;
        profileNameHasSearched = true;
        searchingProfileNames = true;
        profileNameError = false;
        profileNameResults = [];

        const requestId = profileNameSearchRequestId + 1;
        profileNameSearchRequestId = requestId;

        try {
            const ndkInstance = get(ndk) as unknown as NDK;

            const results = await requestVertexProfileSearch(
                ndkInstance,
                trimmedSearchTerm,
                $currentUser.pubkey,
                {
                    limit: VERTEX_PROFILE_SEARCH_LIMIT,
                    sort: VERTEX_PROFILE_SEARCH_SORT,
                    timeoutMs: VERTEX_PROFILE_SEARCH_TIMEOUT_MS,
                }
            );

            if (profileNameSearchRequestId !== requestId) {
                return;
            }

            const metadataRelays = [
                ...ndkInstance.outboxPool!.connectedRelays(),
                ...ndkInstance.pool!.connectedRelays(),
            ];

            const resolved = await Promise.all(
                results.map(async (entry: { pubkey: Hexpubkey }) => {
                    const metadataFilter = {
                        kinds: [NDKKind.Metadata],
                        authors: [entry.pubkey],
                    };

                    const profileEvent = await fetchEventFromRelaysFirst(
                        ndkInstance,
                        metadataFilter,
                        {
                            relayTimeoutMS: 3000,
                            fallbackToCache: true,
                            explicitRelays: metadataRelays,
                        }
                    );

                    return {
                        pubkey: entry.pubkey,
                        profile: profileEvent ? profileFromEvent(profileEvent) : null,
                    };
                })
            );

            if (profileNameSearchRequestId !== requestId) {
                return;
            }

            profileNameResults = resolved;
        } catch (error) {
            if (profileNameSearchRequestId === requestId) {
                console.error('Error searching profiles by name:', error);
                profileNameError = true;
            }
        } finally {
            if (profileNameSearchRequestId === requestId) {
                searchingProfileNames = false;
            }
        }
    }

    function triggerProfileNameSearch() {
        if (!profileNameQuery) return;
        if (searchingProfileNames) return;
        if (profileNameQuery.length < VERTEX_PROFILE_SEARCH_MIN_LENGTH) return;
        handleProfileNameSearch(profileNameQuery);
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

             const ndkInstance = get(ndk) as unknown as NDK;

             // Fetch user metadata
             const metadataFilter = {
                 kinds: [NDKKind.Metadata],
                 authors: [pubkey],
             };

             const profileEvent = await fetchEventFromRelaysFirst(
                 ndkInstance,
                 metadataFilter,
                 {
                     relayTimeoutMS: 3000,
                     fallbackToCache: true,
                 }
             );

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
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        // Clear freelance naddr results
        showFreelanceNaddrResult = false;
        freelanceEvent = null;
        freelanceNaddrError = false;
        // Clear profile results
        showProfileResult = false;
        userProfile = null;
        profilePubkey = null;
        profileError = false;
        resetProfileNameResults();
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
        showProfileNameResult = false;
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
            } else {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                    debounceTimer = null;
                }
                if (page.url.searchParams.has('searchQuery')) {
                    // Only clear URL params if search was cleared and we have searchQuery param
                    const url = new URL(page.url);
                    url.searchParams.delete('searchQuery');
                    goto(url.toString(), { replaceState: true, keepFocus: true });
                }
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
            if (showProfileResult || showProfileNameResult) {
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

                resetProfileNameResults();
                
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

        const ndkInstance = get(ndk) as unknown as NDK;

        const profileEvent = await fetchEventFromRelaysFirst(ndkInstance, metadataFilter, {
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
        $showLoginModal = true;
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
                                        type="text"
                                        autocomplete={null}
                                        autocapitalize="off"
                                        autocorrect="off"
                                        spellcheck={false}
                                        classes="pr-9"
                                        name="search-satshoot"
                                        id="search-satshoot"
                                    />
                                    {#if searchInput.length}
                                        <button
                                            type="button"
                                            class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-black-500 hover:text-blue-500"
                                            aria-label="Clear search"
                                            onclick={clearSearch}
                                        >
                                            <i class="bx bx-x"></i>
                                        </button>
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
                                    {#if showProfileResult || showProfileNameResult}
                                        <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                            {#if showProfileResult}
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
                                                        <div class="flex flex-col min-w-0">
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
                                            {/if}

                                            {#if showProfileNameResult}
                                                {#if searchingProfileNames}
                                                    <div class="flex items-center justify-center py-4">
                                                        <ProgressRing size={8} />
                                                        <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching profiles...</span>
                                                    </div>
                                                {:else if profileNameError}
                                                    <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                        <i class="bx bx-user-x text-2xl mb-2"></i>
                                                        <p class="text-sm">Profile Search Failed</p>
                                                    </div>
                                                {:else if profileNameHasSearched && profileNameResults.length === 0}
                                                    <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                        <i class="bx bx-search-alt text-2xl mb-2"></i>
                                                        <p class="text-sm">Nothing Found</p>
                                                    </div>
                                                {:else if profileNameResults.length === 0}
                                                    <div class="flex flex-col gap-3">
                                                        <div class="text-center text-gray-700 dark:text-gray-200">
                                                            <p class="text-sm">Search profiles on Vertex (paid)</p>
                                                            <p class="text-xs text-gray-500 dark:text-gray-400">Query: {profileNameQuery}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            class="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors"
                                                            onclick={triggerProfileNameSearch}
                                                        >
                                                            <i class="bx bx-search"></i>
                                                            Search on Vertex
                                                        </button>
                                                    </div>
                                                {:else}
                                                    <div class="flex flex-col">
                                                        {#each profileNameResults as result}
                                                            <a
                                                                class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                                href={'/' + nip19.npubEncode(result.pubkey)}
                                                            >
                                                                <img
                                                                    src={result.profile?.picture || getRoboHashPicture(result.pubkey)}
                                                                    alt="Profile"
                                                                    class="w-10 h-10 rounded-full object-cover"
                                                                />
                                                                <div class="flex flex-col min-w-0">
                                                                    <span class="font-medium text-gray-900 dark:text-gray-100">
                                                                        {result.profile?.name ||
                                                                            result.profile?.displayName ||
                                                                            shortenTextWithEllipsesInMiddle(
                                                                                nip19.npubEncode(result.pubkey),
                                                                                20
                                                                            )}
                                                                    </span>
                                                                    {#if result.profile?.nip05}
                                                                        <span class="text-sm text-gray-600 dark:text-gray-400">
                                                                            {result.profile.nip05}
                                                                        </span>
                                                                    {/if}
                                                                </div>
                                                            </a>
                                                        {/each}
                                                    </div>
                                                {/if}
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
                                        pubkey={$currentUser?.pubkey}
                                        showWoT={false}
                                        size="medium"
                                        classes=""
                                    />
                                </button>
                            {:else if $loggingIn}
                                <div class="flex items-center gap-x-2">
                                    <Button
                                        classes={extraClassesForLogoutBtn}
                                        onClick={() => ($showLogoutModal = true)}
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
                                    classes="pr-9"
                                    data-form-type="other"
                                    data-lpignore="true"
                                    name="search-satshoot-mobile"
                                    id="search-satshoot-mobile"
                                />
                                {#if searchInput.length}
                                    <button
                                        type="button"
                                        class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-black-500 hover:text-blue-500"
                                        aria-label="Clear search"
                                        onclick={clearSearch}
                                    >
                                        <i class="bx bx-x"></i>
                                    </button>
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
                                {#if showProfileResult || showProfileNameResult}
                                    <div class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4">
                                        {#if showProfileResult}
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
                                                    <div class="flex flex-col min-w-0">
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
                                        {/if}

                                        {#if showProfileNameResult}
                                            {#if searchingProfileNames}
                                                <div class="flex items-center justify-center py-4">
                                                    <ProgressRing size={8} />
                                                    <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching profiles...</span>
                                                </div>
                                            {:else if profileNameError}
                                                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                    <i class="bx bx-user-x text-2xl mb-2"></i>
                                                    <p class="text-sm">Profile Search Failed</p>
                                                </div>
                                            {:else if profileNameHasSearched && profileNameResults.length === 0}
                                                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                                                    <i class="bx bx-search-alt text-2xl mb-2"></i>
                                                    <p class="text-sm">Nothing Found</p>
                                                </div>
                                            {:else if profileNameResults.length === 0}
                                                <div class="flex flex-col gap-3">
                                                    <div class="text-center text-gray-700 dark:text-gray-200">
                                                        <p class="text-sm">Search profiles on Vertex (paid)</p>
                                                        <p class="text-xs text-gray-500 dark:text-gray-400">Query: {profileNameQuery}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        class="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors"
                                                        onclick={triggerProfileNameSearch}
                                                    >
                                                        <i class="bx bx-search"></i>
                                                        Search on Vertex
                                                    </button>
                                                </div>
                                            {:else}
                                                <div class="flex flex-col">
                                                    {#each profileNameResults as result}
                                                        <a
                                                            class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                            href={'/' + nip19.npubEncode(result.pubkey)}
                                                        >
                                                            <img
                                                                src={result.profile?.picture || getRoboHashPicture(result.pubkey)}
                                                                alt="Profile"
                                                                class="w-10 h-10 rounded-full object-cover"
                                                            />
                                                            <div class="flex flex-col min-w-0">
                                                                <span class="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                                                    {result.profile?.name ||
                                                                        result.profile?.displayName ||
                                                                        shortenTextWithEllipsesInMiddle(
                                                                            nip19.npubEncode(result.pubkey),
                                                                            20
                                                                        )}
                                                                </span>
                                                                {#if result.profile?.nip05}
                                                                    <span class="text-xs text-gray-600 dark:text-gray-400">
                                                                        {result.profile.nip05}
                                                                    </span>
                                                                {/if}
                                                            </div>
                                                        </a>
                                                    {/each}
                                                </div>
                                            {/if}
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
