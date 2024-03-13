<script lang="ts">
    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import ndk from "$lib/stores/ndk";

    $: npub = $page.params.profile;
     
</script>

<div class="flex justify-center">
    <UserCard ndk={$ndk} npub={npub} />
</div>
