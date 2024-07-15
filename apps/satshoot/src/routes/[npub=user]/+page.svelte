<script lang="ts">
    import { page } from '$app/stores';
    import Reputation from '$lib/components/OrderBook/Reputation.svelte';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import ndk from '$lib/stores/ndk';

    $: npub = $page.params.npub;
    $: user = $ndk.getUser({npub: npub});
     
    $: if (npub) console.log('npub changed', npub)
    $: if (user){
        user = user;
    }

</script>

<div class="flex flex-col gap-y-4 items-center p-4">
    <UserCard {user} />
    <!-- Show reputation defaulting ratings to the type of review
    <!-- that contains more reviews -->
    <Reputation user={user.pubkey} type={undefined}/>
</div>
