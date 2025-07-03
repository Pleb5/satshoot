<script lang="ts">
    import { goto } from '$app/navigation';

    interface Props {
        url?: string;
        external?: boolean;
        children?: import('svelte').Snippet;
    }

    let { url = '', external = false, children }: Props = $props();

    const handleClick = (e: Event) => {
        if (!external) {
            e.preventDefault();
            goto(url, { replaceState: false });
        }
    };
</script>

<a
    href={url}
    class="link"
    onclick={handleClick}
    rel={external ? 'noopener noreferrer' : ''}
    target={external ? '_blank' : ''}
>
    {@render children?.()}
</a>
