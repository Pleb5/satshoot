<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';

    function handleLearnMore() {
        const element = document.getElementById('about');
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
</script>

<div class="w-full flex flex-col justify-center items-center py-4 bg-black-100 mb-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px]">
            <div class="w-full flex flex-col gap-[0px] items-center">
                <div
                    class="w-full rounded-[8px] shadow-soft outline outline-[8px] outline-[white] relative flex flex-col justify-end gap-[50px] p-[50px] bg-[url('https://image.nostr.build/925b24ec1aaf7cbde131b2ea2c178cead8a5dfb9514e1d4ae4d4b4cc2a318fb3.jpg')] bg-center bg-cover bg-no-repeat max-[992px]:gap-[15px] max-[992px]:p-[15px] dark:outline-brightGray"
                >
                    <div
                        class="w-full flex flex-col justify-center items-center gap-[15px] text-white z-1"
                        style="text-shadow: 0 0 4px rgba(0,0,0,0.35);"
                    >
                        <h1 class="font-bold text-[52px] text-center max-[576px]:text-[38px]">
                            Unstoppable Freelancing
                        </h1>
                        <p class="max-w-[1000px] text-center text-[24px] max-[576px]:text-[18px]">
                            Join the Freedom Economy. Take full control. No middle-men.
                        </p>
                        <div class="w-full flex flex-row justify-center items-center gap-[10px]">
                            <Button onClick={handleLearnMore}>Learn more</Button>
                        </div>
                    </div>
                    <div
                        class="w-full flex flex-row justify-center items-center gap-[50px] mb-[-150px] z-1 max-[992px]:flex-col max-[992px]:gap-[25px] max-[992px]:mb-[-125px]"
                    >
                        <div
                            class="w-full bg-white-700 rounded-[6px] shadow-soft backdrop-blur-[20px] p-[25px] flex flex-col gap-[20px] justify-center items-center dark:bg-brightGray-700"
                        >
                            <h2 class="text-center font-[800] text-[32px]">Find Skilled People</h2>
                            <p class="text-center">
                                Have a technical issue? Need a hand in development? Create Job Post
                                and start getting Bids from Freelancers!
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
                                See available Jobs that match your expertise. Work out your
                                conditions and make your Bid
                            </p>
                            <Button
                                classes="max-w-[75%] max-[576px]:max-w-[100%]"
                                fullWidth
                                href="/jobs/"
                            >
                                Discover Opportunities
                            </Button>
                        </div>
                    </div>
                    <div
                        class="absolute inset-0 rounded-[8px] bg-black-300 transition-all ease duration-[0.4s] z-0"
                    ></div>
                </div>
            </div>
        </div>
    </div>
</div>
