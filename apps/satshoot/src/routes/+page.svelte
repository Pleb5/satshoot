<script lang="ts">
    import IntroSection from '$lib/components/HomePage/IntroSection.svelte';
    import JobListing from '$lib/components/HomePage/JobListing.svelte';
    import JobTags from '$lib/components/HomePage/JobTags.svelte';
    import About from '$lib/components/HomePage/About.svelte';
    import NostrSection from '$lib/components/HomePage/NostrSection.svelte';
    import EcashSection from '$lib/components/HomePage/EcashSection.svelte';
    import ProsSection from '$lib/components/HomePage/ProsSection.svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

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
    <JobTags />
    <About />
    <NostrSection />
    <EcashSection />
    <ProsSection />
</div>
