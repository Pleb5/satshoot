<script lang="ts">
    export let title: string;
    export let description: string;
    export let bech32ID: string;

    let processedDescription = '';

    $: if (!title) {
        title = 'No title';
    }

    $: {
        if (description) {
            if (description.length > 80) {
                processedDescription = description.substring(0, 80) + '...';
            } else {
                processedDescription = description;
            }
        } else {
            processedDescription = 'No description!';
        }
    }
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
                {@html processedDescription}
            </p>
        </div>
    </div>
</div>
