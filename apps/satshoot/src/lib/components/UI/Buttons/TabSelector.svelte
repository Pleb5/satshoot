<script lang="ts">
    import Button from './Button.svelte';

    type Tab = { id: any; label: string; icon?: string };

    export let tabs: Tab[];
    export let selectedTab: number | null = null;

    const handleClick = (tab: Tab) => {
        if (tab.id !== selectedTab) {
            selectedTab = tab.id;
        }
    };

    const tabSelectorClasses =
        'w-full flex flex-row flex-wrap p-[5px] gap-[10px] rounded-[6px] bg-[rgb(255,255,255,1)] border-[2px] border-[rgb(0,0,0,0.1)]';
</script>

<div class={tabSelectorClasses}>
    {#each tabs as tab}
        <Button
            variant={selectedTab === tab.id ? 'contained' : 'text'}
            grow
            on:click={() => handleClick(tab)}
        >
            {#if tab.icon}
                <i class="bx bxs-{tab.icon} text-[18px]"></i>
            {/if}
            {tab.label}
        </Button>
    {/each}
</div>
