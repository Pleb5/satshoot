<script lang="ts">
    interface Props {
        extraClasses?: string;
    }

    let { extraClasses = 'text-lg' }: Props = $props();
</script>

<span class="text-yellow-500">
    <i class="fa-solid fa-bolt {extraClasses}"></i>
</span>
