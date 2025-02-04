<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const dispatch = createEventDispatcher();

    const navLinks = [
        {
            href: '/',
            label: 'Home',
        },
        {
            href: '/jobs/',
            label: 'Jobs',
        },
        {
            href: '/about/',
            label: 'About',
        },
    ];
</script>

{#each navLinks as { label, href }}
    <Button
        variant="text"
        {href}
        classes="font-[700] text-black-500 text-[18px] hover:text-blue-500 hover:bg-transparent"
        on:click={() => dispatch('click')}
    >
        {label}
    </Button>
{/each}
