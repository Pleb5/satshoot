<script>
    import Button from '../Buttons/Button.svelte';

    export let text = ''; // The full text to display
    export let maxCharacters = 100; // Maximum characters to show when collapsed
    export let expandText = 'Expand'; // Text for the expand button
    export let collapseText = 'Collapse'; // Text for the collapse button

    let isExpanded = false; // State to track if content is expanded

    const toggleExpand = () => {
        isExpanded = !isExpanded;
    };
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
        <Button on:click={toggleExpand}>
            <p>{isExpanded ? collapseText : expandText}</p>
        </Button>
    {/if}
</div>
