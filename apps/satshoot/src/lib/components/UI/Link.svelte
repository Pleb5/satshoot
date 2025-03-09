<script lang='ts'>
    import { goto } from '$app/navigation';
    
    export let url = '';
    export let external = false;
    
    const handleClick = (e: Event) => {
        if (!external) {
            e.preventDefault();
            goto(url, { replaceState: false});
        }
    };
</script>

<a
    href={url}
    class="text-blue-600 hover:text-blue-800 hover:underline"
    on:click={handleClick}
    rel={external ? 'noopener noreferrer' : ''}
    target={external ? '_blank' : ''}
>
    <slot></slot>
</a>
