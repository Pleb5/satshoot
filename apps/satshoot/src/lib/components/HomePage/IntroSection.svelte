<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';

    function handleLearnMore() {
        const element = document.getElementById('about');
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
</script>

<div class="w-full flex flex-col justify-center items-center py-4 bg-black-100 mb-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[25px]">
            <div
                class="w-full h-[250px] max-[992px]:h-[160px] rounded-[8px] shadow-soft flex flex-col items-center justify-center gap-5"
            >
                <img src="/img/banner-light.svg" alt="banner" />
                <p class="font-[Inter] text-2xl font-medium">Jobs. Services. Reputation.</p>
            </div>
            <div
                class="w-full flex flex-row justify-center items-center gap-[25px] max-[992px]:flex-col"
            >
                <div
                    class="w-full bg-white-700 rounded-[6px] shadow-soft backdrop-blur-[20px] p-[25px] flex flex-col gap-[20px] justify-center items-center dark:bg-brightGray-700"
                >
                    <h2 class="text-center font-[800] text-[32px]">Find Skilled People</h2>
                    <p class="text-center">
                        Have a technical issue? Need a hand in development? Create Job Post and
                        start getting Bids from Freelancers!
                    </p>
                    <Button
                        classes="max-w-[75%] max-[576px]:max-w-[100%]"
                        fullWidth
                        href="/post-job/"
                    >
                        Create Job Listing
                    </Button>
                </div>
                <div
                    class="w-full bg-white-700 rounded-[6px] shadow-soft backdrop-blur-[20px] p-[25px] flex flex-col gap-[20px] justify-center items-center dark:bg-brightGray-700"
                >
                    <h2 class="text-center font-[800] text-[32px]">Look For Work</h2>
                    <p class="text-center">
                        See available Jobs that match your expertise. Work out your conditions and
                        make your Bid
                    </p>
                    <Button classes="max-w-[75%] max-[576px]:max-w-[100%]" fullWidth href="/jobs/">
                        Discover Opportunities
                    </Button>
                </div>
            </div>
            <div class="w-full flex flex-row justify-center items-center">
                <Button onClick={handleLearnMore}>Learn more</Button>
            </div>
        </div>
    </div>
</div>
