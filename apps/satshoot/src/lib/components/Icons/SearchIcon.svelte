<script lang="ts">
    interface Props {
        sizeClass?: string;
    }

    let { sizeClass = 'text-lg' }: Props = $props();
</script>

<span class="">
    <i class="fa-solid fa-magnifying-glass {sizeClass}"></i>
</span>

