<script lang="ts">
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { broadcastUserProfile, fetchEventFromRelaysFirst } from '$lib/utils/helpers';
    import {
        NDKKind,
        profileFromEvent,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    const toastStore = getToastStore();

    let userProfile: NDKUserProfile = {};

    $: if ($currentUser) {
        setProfile($currentUser);
    }

    async function setProfile(user: NDKUser) {
        // Logged in user's metadata MUST be fetched from relays
        // to avoid metadata edit from stale state
        // Otherwise we can fall back to cache
        const fallBackToCache = user.pubkey !== $currentUser?.pubkey;

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
            3000,
            fallBackToCache,
            metadataRelays
        );

        if (profile) {
            userProfile = profileFromEvent(profile);
        }
    }

    async function updateProfile() {
        if ($currentUser) {
            try {
                $currentUser.profile = userProfile;
                await broadcastUserProfile($ndk, userProfile);

                const t: ToastSettings = {
                    message: `Profile Updated!`,
                };
                toastStore.trigger(t);
            } catch (e) {
                const t: ToastSettings = {
                    message: `Profile update failed! Reason: ${e}`,
                };
                toastStore.trigger(t);
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
                    <label class="font-[600]" for="pofile_picture_url">Profile Picture</label>
                </div>
                <Input
                    id="profile_picture_url"
                    type="url"
                    placeholder="Profile Picture URL"
                    bind:value={userProfile.image}
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

        <Button on:click={updateProfile}>Save</Button>
    </div>
{/if}
