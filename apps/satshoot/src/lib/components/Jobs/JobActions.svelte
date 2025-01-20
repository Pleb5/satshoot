<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            <Button
                classes="bg-[rgba(0,0,0,0.1)] text-[rgba(0,0,0,0.5)] scale-[1] w-auto flex-grow justify-start"
            >
                <i class="bx bxs-share" />
                Share
            </Button>
        </div>
    </div>
</div>
