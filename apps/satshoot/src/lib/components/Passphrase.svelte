<script lang="ts">
    import Button from './UI/Buttons/Button.svelte';
    import Input from './UI/Inputs/input.svelte';

    interface Props {
        passphrase: string;
        confirmPassphrase: string;
        btnLabel: string;
        roundedTop?: boolean;
        onSubmit: () => void;
    }

    let {
        passphrase = $bindable(),
        confirmPassphrase = $bindable(),
        btnLabel,
        roundedTop = false,
        onSubmit,
    }: Props = $props();

    let showPassphrase = $state(false);
    let showConfirmPassphrase = $state(false);

    // Reactive declarations to handle validation
    let passphraseValid = $derived(passphrase.length > 13);
    let confirmPassphraseValid = $derived(passphraseValid && passphrase === confirmPassphrase);

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 dark:border-white-100 border-t-[0px] overflow-hidden';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap p-[5px] overflow-hidden rounded-b-[6px] border-[1px] border-black-100 dark:border-white-100 border-t-[0px]';
</script>

<!-- Passphrase Input -->
<div class={inputWrapperClasses} class:rounded-t-[6px]={roundedTop}>
    <Input
        type={showPassphrase ? 'text' : 'password'}
        placeholder="Enter Passphrase..."
        classes={!passphraseValid ? 'text-error-500' : ''}
        bind:value={passphrase}
        grow
        noBorder
        notRounded
    />
    <Button
        variant="outlined"
        classes="border-l-[1px] border-l-black-100 rounded-[0px]"
        onClick={() => (showPassphrase = !showPassphrase)}
    >
        <i class={showPassphrase ? 'bx bxs-hide' : 'bx bxs-show'}></i>
    </Button>
</div>

<!-- Confirm Passphrase Input -->
<div class={inputWrapperClasses}>
    <Input
        type={showConfirmPassphrase ? 'text' : 'password'}
        placeholder="Confirm Passphrase..."
        classes={!confirmPassphraseValid ? 'text-error-500' : ''}
        bind:value={confirmPassphrase}
        grow
        noBorder
        notRounded
    />
    <Button
        variant="outlined"
        classes="border-l-[1px] border-l-black-100 rounded-[0px]"
        onClick={() => (showConfirmPassphrase = !showConfirmPassphrase)}
    >
        <i class={showConfirmPassphrase ? 'bx bxs-hide' : 'bx bxs-show'}></i>
    </Button>
</div>

<div class={btnWrapperClasses}>
    <Button grow onClick={onSubmit}>
        <i class="bx bx-log-in-circle"></i>
        {btnLabel}
    </Button>
</div>
