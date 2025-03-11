<script lang="ts">
    import { validateSingleSeedWord } from '$lib/utils/login';
    import { clipboard } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';

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
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-black-200 dark:border-white-200 border-t-[0px]';
</script>

<div class="w-full flex flex-row gap-[5px]">
    <p class={labelClasses}>Seed words</p>
</div>
<div
    class="w-full grid grid-cols-2 gap-[1px] flex-row rounded-tr-[6px] overflow-hidden border-[1px] border-black-100 dark:border-white-100"
>
    {#each words as word, index}
        <div
            class="w-full h-[40px] flex flex-row bg-black-50 border-b-[1px] border-b-black-100 overflow-hidden dark:border-white-100"
        >
            <p
                class="h-full flex flex-row justify-center items-center min-w-[45px] bg-white font-[500] text-black-500 dark:bg-white-50 dark:text-white"
            >
                {index + 1 < 10 ? `0${index + 1}` : index + 1}
            </p>
            <Input
                type="text"
                bind:value={words[index]}
                disabled={inputsDisabled}
                placeholder="Seed word..."
                classes={!validateSingleSeedWord(words[index]) ? 'input-error' : ''}
                noBorder
                notRounded
            />
        </div>
    {/each}
</div>
{#if showCopyButton}
    <div class={btnWrapperClasses}>
        <Button
            variant="outlined"
            on:click={onCopySeed}
            classes="rounded-[0] bg-red-500 hover:bg-red-600 text-white"
            grow
        >
            <span use:clipboard={words.join(' ')}>
                {copiedSeed ? 'Copied' : 'Dangerously Copy'}
            </span>
        </Button>
    </div>
{/if}
