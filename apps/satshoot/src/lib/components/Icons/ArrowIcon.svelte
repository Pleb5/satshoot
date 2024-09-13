<script lang="ts">
    export let arrowType = 'chevron'
    export let fill = 'solid'
    export let direction = 'right'
    export let sizeClass = 'text-lg';
</script>

<span class="">
    <i class="fa-{fill} fa-{arrowType}-{direction} {sizeClass}"></i>
</span>
