<script lang="ts">
    import type { NDKUser } from "@nostr-dev-kit/ndk";
    import type NDK from "@nostr-dev-kit/ndk";

    import { Avatar } from "@skeletonlabs/skeleton";
    /**
     * The NDK instance you want to use
     */
    export let ndk: NDK;

    /**
     * The npub of the user you want to display a user card for
     */
    export let npub: string | undefined = undefined;

    /**
     * The user object of the user you want to display a user card for
     */
    export let user: NDKUser | undefined = undefined;

    if (!user) {
        let opts = { npub };
        try {
            user = ndk.getUser(opts);
        } catch (e) {
            console.error(`error trying to get user`, { opts }, e);
        }
    }

</script>

{#await user?.fetchProfile()}
    <div class="" >Loading user...</div>
{:then userProfile}
    <div class="card p-4">
        <header class="mb-8">
            <div class="grid grid-cols-3 justify-evenly">
                <Avatar 
                    class="rounded-full border-white placeholder-white"
                    src={userProfile?.image}
                /> 
                <div class="text-center font-bold text-2xl">{userProfile?.name}</div>
            </div>
        </header>
        <h4 class="h4">Bio:</h4>
        <div class="flex flex-col gap-y-2">
            <div>{userProfile?.bio || userProfile?.about}</div>
        </div>
        <footer class="mt-4">
            <h4 class="h4">Other:</h4>
            <div class="flex flex-col gap-y-1">
                <div>Nip05: {userProfile?.nip05 ?? '?'}</div>
                <div>Npub: {npub}</div>
            </div>
        </footer>
    </div>
{:catch error}
    <div class="text-error-400-500-token">Error fetching user: {error}</div>
{/await}

