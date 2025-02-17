<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { searchTerms } from '$lib/stores/search';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';

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
        'outline-[5px] outline-white border-[1px] border-black-100 dark:border-white-100 gap-[2px]';

    const termWrapperClasses =
        'flex flex-row gap-[5px] px-[10px] py-[1px] bg-black-100 ' +
        'border-[1px] border-black-100 dark:border-white-100 rounded-[4px] items-center hover:bg-blue-500 group';

    const termClasses =
        'transition ease duration-[0.2s] text-[14px] border-r-[1px] border-r-black-100 ' +
        'pr-[10px] group-hover:text-white group-hover:border-r-white-200';
</script>

{#if $modalStore[0]}
    <Popup title="Search">
        <div class="w-full flex flex-col">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="flex flex-col gap-[5px]">
                    <label for="search-input" class="m-[0px] text-[14px] font-[500]"
                        >Search (for: term)</label
                    >
                    <div class="flex flex-col gap-[10px]">
                        <div class="w-full flex flex-col gap-[5px]">
                            <div class={inputWrapperClasses}>
                                <Input
                                    id="search-input"
                                    bind:value={searchInput}
                                    onKeyPress={handleEnterKey}
                                    placeholder="Search term or add tag"
                                    fullWidth
                                    noBorder
                                    notRounded
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
                            <label for="added-tags" class="m-[0px] text-[14px] font-[500]"
                                >Added tags</label
                            >
                            <div
                                id="added-tags"
                                class="w-full flex flex-row flex-wrap gap-[5px] p-[5px] border-[1px] border-black-100 dark:border-white-100 rounded-[4px] min-h-[40px]"
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
    </Popup>
{/if}
