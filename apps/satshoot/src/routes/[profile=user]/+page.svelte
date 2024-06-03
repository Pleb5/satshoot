<script lang="ts">
    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";

    $: npub = $page.params.profile;
     
</script>

<div class="flex justify-center">
    <UserCard npub={npub} />
</div>
