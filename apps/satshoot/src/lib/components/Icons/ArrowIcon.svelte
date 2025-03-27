<script lang="ts">
    interface Props {
        arrowType?: string;
        fill?: string;
        direction?: string;
        sizeClass?: string;
    }

    let {
        arrowType = 'chevron',
        fill = 'solid',
        direction = 'right',
        sizeClass = 'text-lg'
    }: Props = $props();
</script>

<span class="">
    <i class="fa-{fill} fa-{arrowType}-{direction} {sizeClass}"></i>
</span>
