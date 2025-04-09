<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { OnboardingStep, onboardingStep } from '$lib/stores/gui';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { broadcastUserProfile } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import {
        NDKKind,
        profileFromEvent,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { getToastStore, ProgressRadial, type ToastSettings } from '@skeletonlabs/skeleton';

    const toastStore = getToastStore();

    let userProfile = $state<NDKUserProfile>({});
    let updating = $state(false);

    const redirectPath = $derived(page.url.searchParams.get('redirectPath'));

    $effect(() => {
        if ($currentUser) {
            setProfile($currentUser);
        }
    });

    async function setProfile(user: NDKUser) {
        // Logged in user's metadata MUST be fetched from relays
        // to avoid metadata edit from stale state
        // Otherwise we can fall back to cache
        const fallbackToCache = user.pubkey !== $currentUser?.pubkey;

        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [user.pubkey],
        };

        const metadataRelays = [
            ...$ndk.outboxPool!.connectedRelays(),
            ...$ndk.pool!.connectedRelays(),
        ];

        const profile = await fetchEventFromRelaysFirst(
            metadataFilter,
            {
                relayTimeoutMS:4000,
                fallbackToCache,
                explicitRelays: metadataRelays
            }
        );

        if (profile) {
            userProfile = profileFromEvent(profile);
        } else {
            const t: ToastSettings = {
                message: `<p class='text-center font-bold'>Could NOT load Profile!</p>
                          <p class='text-center font-bold'>Try to refresh page!</p>
                         `,
                background: 'bg-error-300-600-token',
                autohide: false,
            };
            toastStore.trigger(t);
        }
    }

    async function updateProfile() {
        if (updating) return;

        if ($currentUser) {
            try {
                updating = true;

                $currentUser.profile = userProfile;
                await broadcastUserProfile($ndk, userProfile);

                const t: ToastSettings = {
                    message: `Profile Updated!`,
                };
                toastStore.trigger(t);

                if (redirectPath) {
                    goto(redirectPath);
                }

                if ($onboardingStep === OnboardingStep.Account_Created) {
                    $onboardingStep = OnboardingStep.Profile_Updated;
                    goto('/settings/relays');
                }
            } catch (e) {
                const t: ToastSettings = {
                    message: `Profile update failed! Reason: ${e}`,
                };
                toastStore.trigger(t);
            } finally {
                updating = false;
            }
        }
    }
</script>

{#if $currentUser}
    <div class="w-full flex flex-col gap-[15px] overflow-y-auto">
        <div class="w-full flex flex-col gap-[15px]">
            <!-- Display Name -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="displaly_name">Display Name</label>
                </div>
                <Input
                    id="display_name"
                    type="text"
                    placeholder="Display Name"
                    bind:value={userProfile.displayName}
                    fullWidth
                />
            </div>

            <!-- Bio -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="about">About</label>
                </div>
                <Input
                    id="about"
                    placeholder="About"
                    bind:value={userProfile.about}
                    fullWidth
                    textarea
                />
            </div>

            <!-- Profile Picture -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="profile_picture_url">Profile Picture</label>
                </div>
                <Input
                    id="profile_picture_url"
                    type="url"
                    placeholder="Profile Picture URL"
                    bind:value={userProfile.picture}
                    fullWidth
                />
            </div>

            <!-- Profile Banner -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="profile_banner_url">Profile Banner</label>
                </div>

                <Input
                    id="profile_banner_url"
                    type="url"
                    placeholder="Profile Banner URL"
                    bind:value={userProfile.banner}
                    fullWidth
                />
            </div>

            <!-- NIP-05 Address -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="nip05">NIP-05 Address</label>
                </div>

                <Input
                    id="nip05"
                    type="text"
                    placeholder="name@example.com"
                    bind:value={userProfile.nip05}
                    fullWidth
                />
            </div>

            <!-- LN Address -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="ln_address">LN Address</label>
                </div>

                <Input
                    id="ln_address"
                    type="text"
                    placeholder="name@example.com"
                    bind:value={userProfile.lud16}
                    fullWidth
                />
            </div>

            <!-- Website -->
            <div class="flex flex-col gap-[5px] grow-[1]">
                <div>
                    <label class="font-[600]" for="website">Website</label>
                </div>
                <Input
                    id="website"
                    type="url"
                    placeholder="Website URL (https://example.com)"
                    bind:value={userProfile.website}
                    fullWidth
                />
            </div>
        </div>

        <Button on:click={updateProfile} disabled={updating}>
            Save
            {#if updating}
                <ProgressRadial
                    value={undefined}
                    stroke={60}
                    meter="stroke-white-500"
                    track="stroke-white-500/30"
                    strokeLinecap="round"
                    width="w-8"
                />
            {/if}
        </Button>
    </div>
{/if}
