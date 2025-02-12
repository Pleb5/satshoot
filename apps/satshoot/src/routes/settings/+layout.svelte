<!-- src/routes/settings/+layout.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';

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

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full h-full flex flex-col justify-center items-center py-[50px]">
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
                                    variant={$page.url.pathname === href ? 'contained' : 'text'}
                                >
                                    {label}
                                </Button>
                            {/each}
                        </Card>
                    </div>

                    <!-- Page Content -->
                    <div class="w-full">
                        <Card>
                            <slot />
                        </Card>
                        <!-- This will be replaced by the nested routes -->
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
