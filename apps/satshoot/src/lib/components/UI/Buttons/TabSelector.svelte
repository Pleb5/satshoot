<script lang="ts">
    import Button from './Button.svelte';

    type Tab = { id: any; label: string; icon?: string; notificationCount?: number };

    interface Props {
        tabs: Tab[];
        selectedTab?: number | null;
    }

    let { tabs, selectedTab = $bindable(null) }: Props = $props();

    const handleClick = (tab: Tab) => {
        if (tab.id !== selectedTab) {
            selectedTab = tab.id;
        }
    };

    const tabSelectorClasses =
        'w-full flex flex-row flex-wrap p-[5px] gap-[10px] rounded-[6px] bg-white dark:bg-brightGray border-[2px] border-black-100 dark:border-white-100';
</script>

<div class={tabSelectorClasses}>
    {#each tabs as tab}
        <Button
            variant={selectedTab === tab.id ? 'contained' : 'text'}
            grow
            onClick={() => handleClick(tab)}
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
