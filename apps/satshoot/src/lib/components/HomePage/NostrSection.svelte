<script>
    import Button from '../UI/Buttons/Button.svelte';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div
                class="w-full grid grid-cols-[1.25fr_0.75fr] gap-[50px] max-[768px]:grid-cols-[1fr]"
            >
                <div class="w-full flex flex-col gap-[15px]">
                    <div class="w-full flex flex-col gap-[15px]">
                        <h1 class="text-[32px] font-[600]">Powered by Nostr</h1>
                        <p class="text-justify">
                            Leverage the Nostr protocol and create the business network only you can
                            control.
                            <br />
                            <br />
                            Nostr is the verifiable internet without centralized servers: Users hold
                            their own secret keys allowing for a sovereign online identity and choose
                            their own relay servers to engage with others.
                        </p>
                    </div>
                </div>
                <div
                    class="transition-all ease-[0.4s] w-full flex flex-col justify-center items-center relative overflow-hidden rounded-[8px] pt-[56%] outline outline-4 outline-solid outline-purple-0 hover:outline-blue-500"
                >
                    <img
                        class="absolute top-0 bottom-0 right-0 left-0 h-full w-full object-cover"
                        src="https://image.nostr.build/0b534999147c30286817bbb234238bf68d83b66817020718af7f962da50661b5.png"
                        alt="nostr"
                    />
                    <div
                        class="group transition-all ease duration-[0.4s] w-full absolute top-0 bottom-0 left-0 right-0 bg-white-0 backdrop-blur-[0px] flex flex-col justify-center items-center p-[25px] gap-[10px] text-purple-0 font-bold text-[38px] hover:bg-white-500 hover:backdrop-blur-[10px] hover:text-blue-500 dark:hover:bg-black-500 dark:hover:text-white"
                    >
                        <p class="opacity-0 group-hover:opacity-100">Nostr</p>
                        <Button
                            href="https://nostr.how/en/what-is-nostr"
                            target="_blank"
                            classes="transform scale-[1] max-w-[200px] text-white text-[18px] opacity-0 group-hover:opacity-100 dark:text-white"
                            fullWidth
                        >
                            Learn More
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
