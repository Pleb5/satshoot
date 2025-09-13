<script lang="ts">
    import IntroSection from '$lib/components/HomePage/IntroSection.svelte';
    import JobListing from '$lib/components/HomePage/JobListing.svelte';
    import About from '$lib/components/HomePage/About.svelte';
    import NostrSection from '$lib/components/HomePage/NostrSection.svelte';
    import ProsSection from '$lib/components/HomePage/ProsSection.svelte';
    import PaymentSection from '$lib/components/HomePage/PaymentSection.svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { showLoginModal } from '$lib/stores/modals';


    onMount(() => {
        if (page.url.searchParams.get('state') === 'letsgo') {
            $showLoginModal = true;
        }
    })

</script>

<div class="w-full flex flex-col gap-0 grow">
    <IntroSection />
    <JobListing />
    <About />
    <NostrSection />
    <PaymentSection />
    <ProsSection />
</div>

