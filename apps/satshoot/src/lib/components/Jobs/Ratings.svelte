<script lang="ts">
    export let ratingAsClient: number;
    export let totalClientReviews: number;
    export let ratingAsFreelancer: number;
    export let totalFreelancerReviews: number;
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-col gap-[10px]">
        <div class="w-full flex flex-col gap-[10px]">
            <div
                class="w-full flex flex-row gap-[5px] rounded-[6px] p-0 border-[1px] border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.05)] text-[14px] whitespace-nowrap"
            >
                <p class="w-[50%] p-[5px_8px] border-r border-[rgba(0,0,0,0.1)] font-[600]">
                    Client
                </p>
                <p class="w-[25%] p-[5px_10px] border-r border-[rgba(0,0,0,0.1)] text-center">
                    {ratingAsClient}/5
                </p>
                <p class="w-[25%] p-[5px_10px] text-center">({totalClientReviews})</p>
            </div>
            <div
                class="w-full flex flex-row gap-[5px] rounded-[6px] p-0 border-[1px] border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.05)] text-[14px] whitespace-nowrap"
            >
                <p class="w-[50%] p-[5px_8px] border-r border-[rgba(0,0,0,0.1)] font-[600]">
                    Freelancer
                </p>
                <p class="w-[25%] p-[5px_10px] border-r border-[rgba(0,0,0,0.1)] text-center">
                    {ratingAsFreelancer}/5
                </p>
                <p class="w-[25%] p-[5px_10px] text-center">({totalFreelancerReviews})</p>
            </div>
        </div>
    </div>
</div>
