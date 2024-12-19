<script lang="ts">
    import { beforeNavigate } from '$app/navigation';
    import { hideAppBarsStore } from '$lib/stores/gui';
    import redirectStore from '$lib/stores/network';
    import { onMount } from 'svelte';

    const mainClasses =
        'flex justify-center items-center w-full h-full ' +
        'bg-gradient-to-br from-primary-500 to-tertiary-400 ';
    const cardClasses = 'card card-hover p-8 m-2 bg-success-500 text-white';

    onMount(() => ($hideAppBarsStore = true));

    beforeNavigate(() => ($hideAppBarsStore = false));
</script>

<div class={mainClasses}>
    <div class="flex flex-col items-center gap-y-4">
        <h1 class="h1 text-center text-white">Sign up as:</h1>
        <div class="flex gap-x-4 flex-wrap justify-center gap-y-4">
            <a href="/login" on:click={() => ($redirectStore = '/jobs/')}>
                <div class={cardClasses}>
                    <h1 class="h1 text-center">Freelancer</h1>
                </div>
            </a>
            <a href="/login" on:click={() => ($redirectStore = '/post-ticket')}>
                <div class="{cardClasses} bg-warning-500">
                    <h1 class="h1 text-center">Client</h1>
                </div>
            </a>
        </div>
    </div>
</div>
