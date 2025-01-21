<script lang="ts">
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    export let pubkey: Hexpubkey;
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-col gap-[10px]">
        <div class="w-full flex flex-col gap-[10px]">
            <div class="w-full flex flex-row justify-center">
                <p class="font-[600] text-[24px]">Posted By</p>
            </div>
            <UserProfile {pubkey} />
        </div>
    </div>
</div>
