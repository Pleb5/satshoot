<script lang="ts">
    interface Props {
        extraClasses?: string;
        show?: boolean;
    }

    let { extraClasses = 'text-lg', show = true }: Props = $props();
</script>
<i class="fa-solid { show ? 'fa-eye' : 'fa-eye-slash' } {extraClasses}"></i>
