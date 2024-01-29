<script lang="ts">
    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import ndk from "$lib/stores/ndk";
     
</script>
<h2 class="h2 text-center my-8">User Profile</h2>
<div class="flex justify-center">
    <UserCard ndk={$ndk} npub={$page.params.profile} />
</div>
