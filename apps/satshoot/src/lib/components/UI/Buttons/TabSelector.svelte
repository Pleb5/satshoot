<script lang="ts">
    type Tab = { id: any; label: string };

    export let tabs: Tab[];
    export let selectedTab: number | null = null;

    const handleClick = (tab: Tab) => {
        if (tab.id !== selectedTab) {
            selectedTab = tab.id;
        }
    };

    const tabSelectorClasses =
        'w-full flex flex-row flex-wrap p-[5px] gap-[10px] rounded-[6px] bg-[rgb(255,255,255,1)]  border-[2px] border-[rgb(0,0,0,0.1)]';

    const tabItemClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] rounded-[4px] text-center font-[600] cursor-pointer';

    const selectedTabClasses = 'text-white bg-[rgb(59,115,246)]';
    const nonSelectedTabClasses =
        'hover:text-[rgb(255,255,255,0.65)] hover:bg-[rgb(59,115,246,0.5)] text-[rgb(0,0,0,0.35)]';
</script>

<div class={tabSelectorClasses}>
    {#each tabs as tab}
        <button
            on:click={() => handleClick(tab)}
            class="{tabItemClasses} {selectedTab === tab.id
                ? selectedTabClasses
                : nonSelectedTabClasses}"
        >
            {tab.label}
        </button>
    {/each}
</div>
