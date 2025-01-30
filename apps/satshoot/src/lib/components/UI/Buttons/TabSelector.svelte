<script lang="ts">
    import Button from './Button.svelte';

    type Tab = { id: any; label: string; icon?: string; notificationCount?: number };

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
            {#if tab.notificationCount && tab.notificationCount > 0}
                <span
                    class="bg-[red] text-white rounded-full text-[12px] min-w-[20px] h-[20px] flex items-center justify-center p-[2px]"
                >
                    {tab.notificationCount > 9 ? '9+' : tab.notificationCount}
                </span>
            {/if}
        </Button>
    {/each}
</div>
