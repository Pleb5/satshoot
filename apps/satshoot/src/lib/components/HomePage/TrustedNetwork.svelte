<script lang="ts">
    const profileImageWrapperClasses =
        'transition ease-in-out duration-[0.3s] min-w-[40px] min-h-[40px] w-[40px] h-[40px] ' +
        'rounded-full border-[3px] border-white shadow-[0_0_4px_2px_rgba(0,0,0,0.35)] ' +
        'flex flex-col justify-center items-center relative overflow-hidden bg-[rgba(255,255,255,0.2)] ' +
        'backdrop-blur-[10px] text-[12px] leading-[1] hover:border-[3px] hover:border-[rgb(59,130,246)] ' +
        'hover:scale-[1.1] hover:shadow-[0_0_4px_2px_rgba(0,0,0,0.1)]';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="flex flex-col gap-[15px]">
        <div class="flex flex-col gap-[15px]">
            <div class="">
                <p class="text-[14px] font-[600]">Trusted Network (Followed by):</p>
            </div>
            <div class="w-full flex flex-row gap-[5px]">
                <div
                    class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-[rgba(0,0,0,0.1)]"
                >
                    <a
                        class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                        href="/"
                    >
                        <div class={profileImageWrapperClasses}>
                            <img
                                class="w-full h-full absolute top-0 bottom-0 right-0 left-0 object-cover"
                                src="/img/28bj7a.gif"
                                alt="user profile"
                            />
                        </div>
                    </a>
                </div>
                <div class="w-full flex flex-row flex-wrap">
                    {#each Array(4).fill(0) as item}
                        <a
                            class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center ml-0 hover:mr-[15px] hover:p-[0_10px] hover:pl-0"
                            href="/"
                        >
                            <div class={profileImageWrapperClasses}>
                                <img
                                    class="w-full h-full absolute top-0 bottom-0 right-0 left-0 object-cover"
                                    src="/img/28bj7a.gif"
                                    alt="user profile"
                                />
                            </div>
                        </a>
                    {/each}

                    <div
                        class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center text-[rgba(0,0,0,0.5)] font-[800] no-underline leading-[1] ml-[-15px] hover:ml-0 hover:mr-[15px] hover:p-[0_10px]"
                    >
                        <div class={profileImageWrapperClasses}>
                            <p>50+</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
