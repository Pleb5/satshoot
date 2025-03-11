<script lang="ts">
    import { LoginMethod } from '$lib/stores/ndk';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import Popup from '../UI/Popup.svelte';
    import Nip07Login from '../Login/Nip07Login.svelte';
    import BunkerLogin from '../Login/BunkerLogin.svelte';
    import LocalKeyLogin from '../Login/LocalKeyLogin.svelte';
    import GenerateAccount from '../Login/GenerateAccount.svelte';

    const modalStore = getModalStore();

    let selectedLoginMethod: LoginMethod | null = null;

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

{#if $modalStore[0]}
    <Popup title="Login" {popUpText}>
        <Button
            classes={!selectedLoginMethod ? 'hidden' : ''}
            slot="headerAction"
            variant="outlined"
            on:click={() => (selectedLoginMethod = null)}
        >
            <i class="bx bx-chevron-left" />
        </Button>

        <div class="w-full flex flex-col">
            <div class="w-full flex flex-col gap-[10px] pt-[10px]">
                {#if !selectedLoginMethod}
                    <div class="w-full flex flex-col gap-[10px]">
                        <h3 class="text-[18px]">Choose your login method</h3>
                        <Card classes="gap-[10px]">
                            <Button on:click={() => (selectedLoginMethod = LoginMethod.Nip07)}
                                >Extension</Button
                            >
                            <Button on:click={() => (selectedLoginMethod = LoginMethod.Bunker)}
                                >Bunker</Button
                            >
                            <Button on:click={() => (selectedLoginMethod = LoginMethod.Local)}
                                >Local Key</Button
                            >
                        </Card>
                        <div class="h-[1px] w-full bg-black-200 my-[10px]"></div>
                        <h3 class="text-[18px]">Or, if you're new to Nostr</h3>
                        <Button
                            variant="outlined"
                            on:click={() => (selectedLoginMethod = LoginMethod.Register)}
                            >Generate Account</Button
                        >
                    </div>
                {:else if selectedLoginMethod === LoginMethod.Nip07}
                    <Nip07Login />
                {:else if selectedLoginMethod === LoginMethod.Bunker}
                    <BunkerLogin />
                {:else if selectedLoginMethod === LoginMethod.Local}
                    <LocalKeyLogin />
                {:else if selectedLoginMethod === LoginMethod.Register}
                    <GenerateAccount />
                {/if}
            </div>
        </div>
    </Popup>
{/if}
