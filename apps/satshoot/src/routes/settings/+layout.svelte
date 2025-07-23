<!-- src/routes/settings/+layout.svelte -->
<script lang="ts">
    import { page } from '$app/state';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();

    const navLinks = [
        {
            href: '/settings/general/',
            label: 'General',
        },
        {
            href: '/settings/profile/',
            label: 'Profile',
        },
        {
            href: '/settings/relays/',
            label: 'Relays',
        },
    ];
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full h-full flex flex-col justify-center items-center py-4">
        <div
            class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
        >
            <div class="w-full h-full flex flex-col gap-[15px]">
                <div class="w-full flex flex-row gap-[10px] max-[576px]:flex-col">
                    <!-- Sidebar -->
                    <div class="w-full max-w-[300px] max-[576px]:max-w-full">
                        <Card>
                            {#each navLinks as { label, href }}
                                <Button
                                    {href}
                                    variant={page.url.pathname === href ? 'contained' : 'text'}
                                >
                                    {label}
                                </Button>
                            {/each}
                        </Card>
                    </div>

                    <!-- Page Content -->
                    <div class="w-full">
                        <Card>
                            {@render children?.()}
                        </Card>
                        <!-- This will be replaced by the nested routes -->
                    </div>

                    <div
                        class="w-full max-w-[300px] max-[576px]:max-w-full flex flex-col gap-[10px] text-[16px] text-center"
                    >
                        {#if page.route.id === '/settings/general'}
                            <Card>
                                <p>Store Your Secret key (nsec) securely.</p>
                                <p>
                                    Dedicated Signer apps are more secure than pasting your nsec
                                    into a nostr app.
                                </p>
                                <p>
                                    Learn about Signer apps
                                    <a
                                        href="https://nostrapps.com/#signers"
                                        class="anchor"
                                        target="_blank"
                                    >
                                        here
                                    </a>
                                </p>
                            </Card>
                        {:else if page.route.id === '/settings/profile'}
                            <Card>
                                <p>
                                    For sending and receiving payments, setup your
                                    <a href="https:/https://coinos.io/" class="anchor" target="_blank">
                                        LN address
                                    </a>
                                    or your
                                    <a href="/my-cashu-wallet/" class="anchor"> Nostr Wallet </a>
                                    .
                                </p>
                                <br />
                                <p>
                                    A personal website can build trust. Start yours on
                                    <a href="https://npub.pro" class="anchor" target="_blank">
                                        npub.pro
                                    </a>
                                    with customizable themes and built-in nostr features
                                </p>
                            </Card>
                        {:else}
                            <Card>
                                <p>Selecting reliable relays matters to your experience.</p>
                                <p>
                                    Check out
                                    <a
                                        href="https://next.nostr.watch/"
                                        class="anchor"
                                        target="_blank"
                                    >
                                        nostr watch
                                    </a>
                                    to learn more
                                </p>
                            </Card>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
