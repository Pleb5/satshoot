<script lang="ts">
    import IntroSection from '$lib/components/HomePage/IntroSection.svelte';
    import JobListing from '$lib/components/HomePage/JobListing.svelte';
    import About from '$lib/components/HomePage/About.svelte';
    import NostrSection from '$lib/components/HomePage/NostrSection.svelte';
    import ProsSection from '$lib/components/HomePage/ProsSection.svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import PaymentSection from '$lib/components/HomePage/PaymentSection.svelte';

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: filterList = searchQuery ? searchQuery.split(',') : [];

    $: if (filterList.length > 0) {
        const url = new URL($page.url);
        url.pathname = '/jobs/';
        goto(url.toString());
    }
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <IntroSection />
    <JobListing />
    <About />
    <NostrSection />
    <PaymentSection />
    <ProsSection />
</div>
