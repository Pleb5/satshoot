<script lang="ts">
    let isCollapsed = true;

    const toggleCollapse = () => {
        isCollapsed = !isCollapsed;
    };

    const items = [
        {
            href: '/',
            icon: 'bxs-home',
        },
        {
            href: '/',
            icon: 'bxs-conversation',
        },
        {
            href: '/',
            icon: 'bxs-bell',
        },
        {
            href: '/',
            icon: 'bxs-cog',
        },
        {
            href: '/',
            icon: 'bxs-user',
        },
    ];

    const collapseWrapperClasses =
        'transition-all ease-in-out duration-[0.4s] w-auto fixed bottom-0 ' +
        'transform self-center max-w-[500px] ' +
        'flex flex-row justify-center items-center gap-[8px] p-[10px] z-5 ' +
        'min-h-[85px] max-[576px]:w-full max-[576px]:right-0 max-[576px]:left-0 ' +
        'max-[576px]:translate-x-0 max-[576px]:max-w-none max-[576px]:justify-end';

    const collapseBoxClass =
        'transition-all ease-in-out duration-[0.0s] ' +
        'bg-[#dcdcdc] rounded-[10px] shadow-[0_0_8px_rgba(0,0,0,0.25)] ' +
        'flex flex-row border-white';

    const itemClasses =
        'transition ease-in-out duration-[0.3s] bg-[rgb(59,115,246,0)] ' +
        'text-[24px] border-0 outline-none text-[rgb(0,0,0,0.35)] py-[10px] px-[15px] ' +
        'rounded-[5px] font-semibold transform scale-100 whitespace-nowrap flex flex-row ' +
        'justify-center items-center gap-[8px] hover:bg-[rgb(59,130,246)] hover:text-white';

    const activeItemClasses = 'bg-[rgb(59,115,246)] text-white';

    const collapseTriggerBtnClasses =
        'transition-all ease-in-out duration-[0.4s] py-[15px] px-[5px] ' +
        'bg-[rgb(255,255,255)] text-[rgba(0,0,0,0.25)] shadow-[0_0_4px_0_rgba(0,0,0,0.25)] ' +
        'rounded-[5px] hover:bg-white hover:text-[rgba(0,0,0,0.75)] focus:shadow-[0_0_4px_0_rgba(0,0,0,0.25)] ' +
        'focus:py-[15px] focus:px-[5px]';
</script>

<div
    id="btnBotNavCollapseWrapper"
    class={collapseWrapperClasses +
        ` ${isCollapsed ? 'right-1/2 translate-x-1/2' : 'right-0 translate-x-0'}`}
>
    <div
        id="btnBotNavCollapseBox"
        class={collapseBoxClass}
        class:w-auto={isCollapsed}
        class:w-[0px]={!isCollapsed}
        class:p-[6px]={isCollapsed}
        class:p-[0px]={!isCollapsed}
        class:overflow-auto={isCollapsed}
        class:overflow-hidden={!isCollapsed}
        class:border-0={!isCollapsed}
        class:border-4={isCollapsed}
        class:gap-[6px]={isCollapsed}
        class:gap-[0px]={!isCollapsed}
        class:max-[576px]:w-full={isCollapsed}
        class:max-[576px]:0={!isCollapsed}
    >
        {#each items as { href, icon }}
            <a {href} class={itemClasses}> <i class={`bx ${icon} btnMainIcon`} /> </a>
        {/each}
    </div>
    <button
        id="btnBotNavCollapseTrigger"
        class={collapseTriggerBtnClasses}
        on:click={toggleCollapse}
    >
        <i
            id="btnBotNavCollapseDirection"
            class="bx bxs-chevron-right transform"
            class:rotate-180={!isCollapsed}
            class:rotate-0={isCollapsed}
        />
    </button>
</div>
