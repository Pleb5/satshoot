<script lang="ts">
    import { clipMarkdownText, clipText } from '$lib/utils/misc';
    import Markdown from '../Cards/Markdown.svelte';

    interface Props {
        title: string;
        description: string;
        bech32ID: string;
    }

    let { title, description, bech32ID }: Props = $props();

    const processedTitle = $derived(title || 'No title');
    const processedDescription = $derived(
        description ? clipMarkdownText(description, 100) : 'No description!'
    );
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-col gap-[10px] p-[5px]">
        <a class="w-full" href={'/' + bech32ID}>
            <h4 class="font-semibold text-[18px] overflow-hidden line-clamp-2">
                {processedTitle}
            </h4>
        </a>
        <div class="w-full">
            <p class="font-normal text-[15px] overflow-y-auto">
                <Markdown content={processedDescription} />
            </p>
        </div>
    </div>
</div>
