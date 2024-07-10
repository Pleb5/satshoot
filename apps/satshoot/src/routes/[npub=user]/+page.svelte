<script lang="ts">
    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import ndk from '$lib/stores/ndk';

    $: npub = $page.params.npub;
    $: user = $ndk.getUser({npub: npub});
     
    $: if (npub) console.log('npub changed', npub)
    $: if (user){
        user = user;
    }

</script>

<div class="flex justify-center">
    <div class="m-4">
        <UserCard {user} />
    </div>
</div>
