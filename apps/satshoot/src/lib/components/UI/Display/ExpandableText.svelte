<script>
    import Markdown from '$lib/components/Cards/Markdown.svelte';
    import { clipText } from '$lib/utils/misc';
    import Button from '../Buttons/Button.svelte';

    export let text = ''; // The full text to display
    export let maxCharacters = 100; // Maximum characters to show when collapsed
    export let expandText = 'Expand'; // Text for the expand button
    export let collapseText = 'Collapse'; // Text for the collapse button
    export let renderAsMarkdown = false;

    let isExpanded = false; // State to track if content is expanded

    const toggleExpand = () => {
        isExpanded = !isExpanded;
    };

    $: textToDisplay = isExpanded ? text : clipText(text, maxCharacters);
</script>

<div class="flex flex-col gap-[10px] font-[500] px-[10px] py-[10px]">
    <p>
        {#if renderAsMarkdown}
            <Markdown content={textToDisplay} />
        {:else}
            {textToDisplay}
        {/if}
    </p>
    {#if text.length > maxCharacters}
        <Button on:click={toggleExpand}>
            <p>{isExpanded ? collapseText : expandText}</p>
        </Button>
    {/if}
</div>
