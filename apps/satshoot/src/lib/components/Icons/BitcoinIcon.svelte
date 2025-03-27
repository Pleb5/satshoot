<script lang="ts">
    interface Props {
        extraClasses?: string;
    }

    let { extraClasses = '' }: Props = $props();
</script>

<span class="">
    <i class="fa-brands fa-bitcoin {extraClasses}"></i>
</span>

