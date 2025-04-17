<script lang="ts">
    interface Props {
        extraClasses?: string;
    }

    let { extraClasses = 'text-lg' }: Props = $props();
</script>
<i class="fa-solid fa-gear {extraClasses}"></i>

