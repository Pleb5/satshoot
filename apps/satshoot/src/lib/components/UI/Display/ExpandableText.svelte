<script>
    export let text = ''; // The full text to display
    export let maxCharacters = 100; // Maximum characters to show when collapsed
    export let expandText = 'Expand'; // Text for the expand button
    export let collapseText = 'Collapse'; // Text for the collapse button

    let isExpanded = false; // State to track if content is expanded

    const toggleExpand = () => {
        isExpanded = !isExpanded;
    };

    const expandBtnClasses =
        'transition ease duration-[0.3s] cursor-pointer w-full bg-[rgb(0,0,0,0.1)] flex flex-row justify-center ' +
        'items-center p-[5px] rounded-[4px] text-[rgb(0,0,0,0.5)] hover:text-white hover:bg-[rgb(59,115,246)]';
</script>

<div class="flex flex-col gap-[10px] font-[500] px-[10px] py-[10px]">
    <p>
        {#if isExpanded}
            {text}
        {:else}
            {text.slice(0, maxCharacters)}{text.length > maxCharacters ? '...' : ''}
        {/if}
    </p>
    {#if text.length > maxCharacters}
        <button class={expandBtnClasses} on:click={toggleExpand}>
            <p>{isExpanded ? collapseText : expandText}</p>
        </button>
    {/if}
</div>
