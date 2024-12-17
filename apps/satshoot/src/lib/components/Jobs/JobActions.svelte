<script lang="ts">
    const btnClasses =
        'transition ease-in-out duration-[0.3s] border-none outline-none rounded-[5px] ' +
        'font-[600] transform scale-[1] whitespace-nowrap flex flex-row items-center gap-[10px] ' +
        'w-auto flex-grow bg-[rgba(0,0,0,0.1)] text-[rgba(0,0,0,0.5)] justify-start p-[8px_12px] ' +
        'text-[16px] hover:bg-[rgb(59,130,246)] hover:text-[rgb(255,255,255)]';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <div class="w-full flex flex-row flex-wrap gap-[10px]">
            <button class={btnClasses} type="button">
                <i class="bx bxs-message-rounded" />Message</button
            >
            <button class={btnClasses} type="button"> <i class="bx bxs-share" />Share</button>
            <button class={btnClasses} type="button"> <i class="bx bxs-megaphone" />Report</button>
        </div>
    </div>
</div>
