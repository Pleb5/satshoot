<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let passphrase: string;
    export let confirmPassphrase: string;
    export let btnLabel: string;
    export let roundedTop = false;

    let showPassphrase = false;
    let showConfirmPassphrase = false;

    // Reactive declarations to handle validation
    $: passphraseValid = passphrase.length > 13;
    $: confirmPassphraseValid = passphraseValid && passphrase === confirmPassphrase;

    const inputWrapperClasses =
        'w-full flex flex-row bg-[rgb(0,0,0,0.05)] border-[1px] border-[rgb(0,0,0,0.1)] border-t-[0px] overflow-hidden';

    const inputClasses =
        'grow-[1] border-[0px] border-[rgb(0,0,0,0.15)] rounded-[0px] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0)]';

    const showPassphraseBtnClasses =
        'transition ease duration-[0.3s] text-[rgb(0,0,0,0.5)] px-[10px] border-l-[1px] border-l-[rgb(0,0,0,0.1)] ' +
        'flex flex-row justify-center items-center hover:bg-[rgb(59,115,246)] hover:text-white hover:border-l-[rgb(0,0,0,0.0)]';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-[rgb(0,0,0,0.15)] border-t-[0px]';

    const btnClasses =
        'transition ease duration-[0.3s] grow-[1] text-[rgb(0,0,0,0.5)] px-[10px] py-[5px] ' +
        'flex flex-row justify-center items-center font-[500] gap-[10px] hover:bg-[rgb(59,115,246)] hover:text-white';
</script>

<!-- Passphrase Input -->
<div class={inputWrapperClasses} class:rounded-t-[6px]={roundedTop}>
    {#if showPassphrase}
        <input
            bind:value={passphrase}
            type="text"
            placeholder="Enter Passphrase..."
            class={inputClasses}
            class:input-error={!passphraseValid}
        />
    {:else}
        <input
            bind:value={passphrase}
            type="password"
            placeholder="Enter Passphrase..."
            class={inputClasses}
            class:input-error={!passphraseValid}
        />
    {/if}
    <button class={showPassphraseBtnClasses} on:click={() => (showPassphrase = !showPassphrase)}>
        <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'} />
    </button>
</div>

<!-- Confirm Passphrase Input -->
<div class={inputWrapperClasses}>
    {#if showConfirmPassphrase}
        <input
            bind:value={confirmPassphrase}
            type="text"
            placeholder="Confirm Passphrase..."
            class={inputClasses}
            class:input-error={!confirmPassphraseValid}
        />
    {:else}
        <input
            bind:value={confirmPassphrase}
            type="password"
            placeholder="Confirm Passphrase..."
            class={inputClasses}
            class:input-error={!confirmPassphraseValid}
        />
    {/if}
    <button
        class={showPassphraseBtnClasses}
        on:click={() => (showConfirmPassphrase = !showConfirmPassphrase)}
    >
        <i class={showConfirmPassphrase ? 'bx bxs-hide' : 'bx bxs-show'} />
    </button>
</div>

<div class={btnWrapperClasses}>
    <button
        class={btnClasses}
        disabled={!passphraseValid || !confirmPassphraseValid}
        on:click={() => dispatch('submit')}
    >
        <i class="bx bx-log-in-circle" />
        {btnLabel}
    </button>
</div>
