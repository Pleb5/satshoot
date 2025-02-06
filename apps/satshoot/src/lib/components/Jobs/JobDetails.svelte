<script lang="ts">
    import { clipText } from '$lib/utils/misc';
    import Markdown from '../Cards/Markdown.svelte';

    export let title: string;
    export let description: string;
    export let bech32ID: string;

    $: if (!title) {
        title = 'No title';
    }

    $: processedDescription = description ? clipText(description, 100) : 'No description!';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-col gap-[10px] p-[5px]">
        <a class="w-full" href={'/' + bech32ID}>
            <h4 class="font-semibold text-[18px] overflow-hidden line-clamp-2">
                {title}
            </h4>
        </a>
        <div class="w-full">
            <p class="font-normal text-[15px] overflow-hidden line-clamp-3">
                <Markdown content={processedDescription} />
            </p>
        </div>
    </div>
</div>
