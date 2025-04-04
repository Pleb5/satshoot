<script lang="ts">
    import { getModeUserPrefers, setModeUserPrefers } from '$lib/utils/lightSwitch';
    import { Switch } from '@skeletonlabs/skeleton-svelte';

    let checked = $state(false);

    $effect(() => {
        const mode = getModeUserPrefers() || 'light';
        checked = mode === 'dark';
    });

    const onCheckedChange = (event: { checked: boolean }) => {
        const mode = event.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-mode', mode);
        setModeUserPrefers(mode);
        checked = event.checked;
    };
</script>

<svelte:head>
    <script>
        const mode = localStorage.getItem('mode') || 'light';
        document.documentElement.setAttribute('data-mode', mode);
    </script>
</svelte:head>

<Switch {checked} {onCheckedChange}>
    {#snippet inactiveChild()}<i class="bx bxs-sun"></i>{/snippet}
    {#snippet activeChild()}<i class="bx bxs-moon"></i>{/snippet}
</Switch>
