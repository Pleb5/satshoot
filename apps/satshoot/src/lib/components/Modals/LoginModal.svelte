<script lang="ts">
    import { LoginMethod } from '$lib/stores/session';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import Nip07Login from '../Login/Nip07Login.svelte';
    import BunkerLogin from '../Login/BunkerLogin.svelte';
    import LocalKeyLogin from '../Login/LocalKeyLogin.svelte';
    import GenerateAccount from '../Login/GenerateAccount.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let selectedLoginMethod: LoginMethod | null = $state(null);

    const popUpText = `
<p>
  SatShoot is built on Nostr, which has its own unique way of account creation
  and login
</p>

<p class="text-sm">
  Nostr enables
  <strong> sovereign identities </strong>
  through cryptographic keys. Your
  <strong> "secret" or "private" key </strong>
  is used by Nostr apps to digitally sign all actions you take.
</p>
<p class="text-sm">
  In the case of
  <strong> SatShoot </strong>
  , these actions include:
</p>
<ul class="pl-5 list-disc text-sm">
  <li>Posting a Job or an Offer</li>
  <li>Taking Offers</li>
  <li>Sending messages</li>
  <li>Creating reviews</li>
</ul>
<p class="text-sm">
  This ensures that your data is cryptographically verifiable, proving it
  belongs solely to you. You generate your private key, and it's
  <strong> your responsibility </strong>
  to keep it secure.
</p>
<p class="text-sm">
  Apps require your permission to get signatures for publishing data to Nostr
  relays. You can grant this permission in various ways, meaning there are
  multiple
  <strong>"login"</strong>
  methods with different security tradeoffs.
  <em>Do your own research and choose wisely.</em>
</p>
`;
</script>

<ModalWrapper bind:isOpen title="Login" {popUpText}>
    {#snippet headerAction()}
        <Button
            classes={!selectedLoginMethod ? 'hidden' : ''}
            variant="outlined"
            onClick={() => (selectedLoginMethod = null)}
        >
            <i class="bx bx-chevron-left"></i>
        </Button>
    {/snippet}

    <div class="w-full flex flex-col">
        <div class="w-full flex flex-col gap-[10px] pt-[10px]">
            {#if !selectedLoginMethod}
                <div class="w-full flex flex-col gap-[10px]">
                    <h3 class="text-[18px]">Choose your login method</h3>
                    <Card classes="gap-[10px]">
                        <Button onClick={() => (selectedLoginMethod = LoginMethod.Nip07)}
                            >Extension</Button
                        >
                        <Button onClick={() => (selectedLoginMethod = LoginMethod.Bunker)}
                            >Bunker</Button
                        >
                        <Button onClick={() => (selectedLoginMethod = LoginMethod.Local)}
                            >Local Key</Button
                        >
                    </Card>
                    <div class="h-[1px] w-full bg-black-200 my-[10px]"></div>
                    <h3 class="text-[18px]">Or, if you're new to Nostr</h3>
                    <Button
                        variant="outlined"
                        onClick={() => (selectedLoginMethod = LoginMethod.Register)}
                        >Generate Account</Button
                    >
                    <div class="flex justify-center">
                        <a class="anchor" href="https://github.com/Pleb5/satshoot" target="_blank">
                            <span>Running v0.3.0</span>
                        </a>
                    </div>
                </div>
            {:else if selectedLoginMethod === LoginMethod.Nip07}
                <Nip07Login bind:isOpen />
            {:else if selectedLoginMethod === LoginMethod.Bunker}
                <BunkerLogin bind:isOpen />
            {:else if selectedLoginMethod === LoginMethod.Local}
                <LocalKeyLogin bind:isOpen />
            {:else if selectedLoginMethod === LoginMethod.Register}
                <GenerateAccount bind:isOpen />
            {/if}
        </div>
    </div>
</ModalWrapper>
