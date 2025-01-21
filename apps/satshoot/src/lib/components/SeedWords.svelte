<script lang="ts">
    import { validateSingleSeedWord } from '$lib/utils/login';
    import { clipboard } from '@skeletonlabs/skeleton';
    import Button from './UI/Buttons/Button.svelte';

    export let words: string[];
    export let inputsDisabled = false;
    export let showCopyButton = false;

    let copiedSeed = false;

    function onCopySeed(): void {
        copiedSeed = true;
        setTimeout(() => {
            copiedSeed = false;
        }, 1000);
    }

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.15)] border-b-[0px] text-[14px]';

    const inputClasses =
        'grow-[1] border-[0px] border-[rgb(0,0,0,0.15)] rounded-[0px] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0)]';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-[rgb(0,0,0,0.15)] border-t-[0px]';
</script>

<div class="w-full flex flex-row gap-[5px]">
    <p class={labelClasses}>Seed words</p>
</div>
<div
    class="w-full grid grid-cols-2 gap-[1px] flex-row rounded-tr-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.1)]"
>
    {#each words as word, index}
        <div
            class="w-full h-[40px] flex flex-row bg-[rgb(0,0,0,0.05)] border-b-[1px] border-b-[rgb(0,0,0,0.1)] overflow-hidden"
        >
            <p
                class="h-full flex flex-row justify-center items-center min-w-[45px] bg-white font-[500] text-[rgb(0,0,0,0.5)]"
            >
                {index + 1 < 10 ? `0${index + 1}` : index + 1}
            </p>
            <input
                type="text"
                bind:value={words[index]}
                disabled={inputsDisabled}
                placeholder="Seed word..."
                class={inputClasses}
                class:input-error={!validateSingleSeedWord(words[index])}
            />
        </div>
    {/each}
</div>
{#if showCopyButton}
    <div class={btnWrapperClasses}>
        <Button variant="outlined" on:click={onCopySeed} classes="rounded-[0]" grow>
            <span use:clipboard={words.join(' ')}>
                {copiedSeed ? 'Copied' : 'Copy'}
            </span>
        </Button>
    </div>
{/if}
