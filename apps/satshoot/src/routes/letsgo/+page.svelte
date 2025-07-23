<script>
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    onMount(() => {
        const url = new URL('/', window.location.origin)
        url.searchParams.append('state', 'letsgo')
        goto(url.toString())
    })
</script>
