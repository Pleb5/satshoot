<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { searchTerms } from '$lib/stores/search';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let searchInput = '';

    function handleRemoveTerm(term: string) {
        const newArray = Array.from($searchTerms).filter((t) => t !== term);
        searchTerms.set(new Set(newArray));

        // Get the current query parameters
        const url = new URL($page.url);

        if (newArray.length === 0) {
            url.searchParams.delete('searchTerms');
        } else {
            //update the query parameter
            url.searchParams.set('searchTerms', Array.from(newArray).join(','));
        }

        // Navigate to the updated
        goto(url.toString(), { replaceState: true });
    }

    // Function to handle the "Enter" key press
    function handleEnterKey(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleAdd();
        }
    }

    function handleAdd() {
        if (searchInput) {
            searchTerms.update((terms) => {
                terms.add(searchInput);
                return terms;
            });

            searchInput = '';
        }
    }

    function handleSearch() {
        if (searchInput) {
            searchTerms.update((terms) => {
                terms.add(searchInput);
                return terms;
            });

            searchInput = '';
        }

        // Get the current query parameters
        const url = new URL($page.url);
        // Add or update the query parameter
        url.searchParams.set('searchTerms', Array.from($searchTerms).join(','));
        // Navigate to the updated
        goto(url.toString(), { replaceState: true });

        // close search modal
        modalStore.close();
    }

    const inputWrapperClasses =
        'flex flex-row rounded-[6px] overflow-hidden bg-white outline ' +
        'outline-[5px] outline-white border-[1px] border-[rgb(0,0,0,0.1)] gap-[2px]';

    const inputClasses =
        'w-full border-[0px] border-[rgb(0,0,0,0.15)] ' +
        'rounded-[0px] outline outline-[0px] py-[5px] px-[10px]';

    const termWrapperClasses =
        'flex flex-row gap-[5px] px-[10px] py-[1px] bg-[rgb(0,0,0,0.1)] ' +
        'border-[1px] border-[rgb(0,0,0,0.1)] rounded-[4px] items-center hover:bg-[#3b73f6] group';

    const termClasses =
        'transition ease duration-[0.2s] text-[14px] border-r-[1px] border-r-[rgb(0,0,0,0.1)] ' +
        'pr-[10px] group-hover:text-white group-hover:border-r-[rgb(255,255,255,0.15)]';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[4] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div class="w-full flex flex-col justify-start items-center px-[10px] relative">
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card classes="gap-[10px]">
                        <ModalHeader title="Search" />
                        <div class="w-full flex flex-col">
                            <div class="w-full flex flex-col gap-[10px]">
                                <div class="flex flex-col gap-[5px]">
                                    <label for="search-input" class="m-[0px] text-[14px] font-[500]"
                                        >Search (for: term)</label
                                    >
                                    <div class="flex flex-col gap-[10px]">
                                        <div class="w-full flex flex-col gap-[5px]">
                                            <div class={inputWrapperClasses}>
                                                <input
                                                    id="search-input"
                                                    bind:value={searchInput}
                                                    on:keydown={handleEnterKey}
                                                    class={inputClasses}
                                                    type="text"
                                                    placeholder="Search term or add tag"
                                                />
                                                <Button on:click={handleAdd}>
                                                    <i class="bx bx-plus" />
                                                </Button>
                                                <Button on:click={handleSearch}>
                                                    <i class="bx bx-search" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div class="w-full flex flex-col gap-[5px]">
                                            <label
                                                for="added-tags"
                                                class="m-[0px] text-[14px] font-[500]"
                                                >Added tags</label
                                            >
                                            <div
                                                id="added-tags"
                                                class="w-full flex flex-row flex-wrap gap-[5px] p-[5px] border-[1px] border-[rgb(0,0,0,0.1)] rounded-[4px] min-h-[40px]"
                                            >
                                                {#each $searchTerms as term}
                                                    <div class={termWrapperClasses}>
                                                        <p class={termClasses}>
                                                            {term}
                                                        </p>
                                                        <button
                                                            class="transition ease duration-[0.2s] p-[5px] mr-[-5px] rounded-[4px] group-hover:text-white"
                                                            on:click={() => handleRemoveTerm(term)}
                                                        >
                                                            <i class="bx bx-x" />
                                                        </button>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
