<script lang="ts">
    interface Props {
        label: string;
    }

    let { label }: Props = $props();
</script>

<div class="flex items-center my-4">
    <div class="flex-1 border-t border-gray-300"></div>
    <span class="px-4 text-gray-500 text-sm font-medium">{label}</span>
    <div class="flex-1 border-t border-gray-300"></div>
</div>
