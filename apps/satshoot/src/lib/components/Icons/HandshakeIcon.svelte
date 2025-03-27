<script lang="ts">
    interface Props {
        sizeClass?: string;
        iconType?: string;
    }

    let { sizeClass = 'text-lg', iconType = 'solid' }: Props = $props();
</script>

<span class="">
    <i class="fa-{iconType} fa-handshake {sizeClass}"></i>
</span>
