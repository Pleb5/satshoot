<script lang="ts">
import {
    type NDKUser,
    type NDKUserProfile
} from "@nostr-dev-kit/ndk";

import { Avatar } from "@skeletonlabs/skeleton";

import { onMount } from "svelte";


export let user: NDKUser;
let userProfile: NDKUserProfile;

$: avatarImage = `https://robohash.org/${user.pubkey}`;

onMount(async() => {
    const profile = await user.fetchProfile();
    if (profile) {
        userProfile = profile;
        if (userProfile.image) {
            avatarImage = userProfile.image;
        }
    }
});


</script>

<div>
    <a href={'/' + user.npub}>
        <Avatar
            class="rounded-full border-white"
            src={avatarImage}
        /> 
    </a>
</div>
<div class="flex flex-col gap-y-2">
    <div class="h5 sm:h4 text-center font-bold text-lg sm:text-2xl">
        {
        userProfile?.name
            ?? userProfile?.displayName 
            ?? user.npub.substring(0,10)
        }
    </div>
    <!-- For latest message -->
    <slot />
</div>
