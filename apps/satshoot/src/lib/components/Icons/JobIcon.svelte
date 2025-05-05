<script lang="ts">
    interface Props {
        sizeClass?: string;
    }

    let { sizeClass = 'text-lg' }: Props = $props();
</script>

<i class="fa-solid fa-clipboard-question {sizeClass}"></i>
