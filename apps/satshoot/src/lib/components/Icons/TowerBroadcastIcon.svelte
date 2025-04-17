<script lang="ts">
    interface Props {
        extraClasses?: string;
    }

    let { extraClasses = 'text-lg' }: Props = $props();
</script>

<span class="">
    <i class="fa-solid fa-tower-broadcast {extraClasses}"></i>
</span>

