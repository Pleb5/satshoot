<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Button from './UI/Buttons/Button.svelte';
    import Input from './UI/Inputs/input.svelte';

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

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-[rgb(0,0,0,0.15)] border-t-[0px]';
</script>

<!-- Passphrase Input -->
<div class={inputWrapperClasses} class:rounded-t-[6px]={roundedTop}>
    <Input
        type={showPassphrase ? 'text' : 'password'}
        placeholder="Enter Passphrase..."
        classes={!passphraseValid ? 'input-error' : ''}
        bind:value={passphrase}
        grow
        noBorder
        notRounded
    />
    <Button
        variant="outlined"
        classes="border-l-[1px] border-l-[rgb(0,0,0,0.1)] rounded-[0px]"
        on:click={() => (showPassphrase = !showPassphrase)}
    >
        <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'} />
    </Button>
</div>

<!-- Confirm Passphrase Input -->
<div class={inputWrapperClasses}>
    <Input
        type={showConfirmPassphrase ? 'text' : 'password'}
        placeholder="Confirm Passphrase..."
        classes={!confirmPassphraseValid ? 'input-error' : ''}
        bind:value={confirmPassphrase}
        grow
        noBorder
        notRounded
    />
    <Button
        variant="outlined"
        classes="border-l-[1px] border-l-[rgb(0,0,0,0.1)] rounded-[0px]"
        on:click={() => (showConfirmPassphrase = !showConfirmPassphrase)}
    >
        <i class={showConfirmPassphrase ? 'bx bxs-hide' : 'bx bxs-show'} />
    </Button>
</div>

<div class={btnWrapperClasses}>
    <Button
        variant="outlined"
        classes="font-[500] rounded-[0]"
        grow
        on:click={() => dispatch('submit')}
    >
        <i class="bx bx-log-in-circle" />
        {btnLabel}
    </Button>
</div>
