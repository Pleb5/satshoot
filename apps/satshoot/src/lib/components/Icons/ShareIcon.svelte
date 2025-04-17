<script lang="ts">
    interface Props {
        extraClasses?: string;
    }

    let { extraClasses = 'text-lg' }: Props = $props();
</script>

<span class="">
    <i class="fa-solid fa-share-nodes {extraClasses}"></i>
</span>
