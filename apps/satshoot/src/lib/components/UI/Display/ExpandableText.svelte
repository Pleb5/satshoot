<script lang="ts">
    import Markdown from '$lib/components/Cards/Markdown.svelte';
    import { clipText } from '$lib/utils/misc';
    import Button from '../Buttons/Button.svelte';

    interface Props {
        text?: string; // The full text to display
        maxCharacters?: number; // Maximum characters to show when collapsed
        expandText?: string; // Text for the expand button
        collapseText?: string; // Text for the collapse button
        renderAsMarkdown?: boolean;
    }

    let {
        text = '',
        maxCharacters = 100,
        expandText = 'Expand',
        collapseText = 'Collapse',
        renderAsMarkdown = true,
    }: Props = $props();

    let isExpanded = $state(false); // State to track if content is expanded

    const toggleExpand = () => {
        isExpanded = !isExpanded;
    };

    let textToDisplay = $derived(isExpanded ? text : clipText(text, maxCharacters));
</script>

<div class="flex flex-col gap-[10px] font-[500] px-[10px] py-[10px]">
    <div class="w-full wrap-normal overflow-hidden">
        {#if renderAsMarkdown}
            <Markdown content={textToDisplay} />
        {:else}
            <p class="wrap-anywhere">{textToDisplay}</p>
        {/if}
    </div>
    {#if text.length > maxCharacters}
        <Button onClick={toggleExpand}>
            <p>{isExpanded ? collapseText : expandText}</p>
        </Button>
    {/if}
</div>
