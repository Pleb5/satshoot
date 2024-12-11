<script lang="ts">
    import NavLinks from './NavLinks.svelte';
    import ProfileDropdown from './ProfileDropdown.svelte';

    export let loginBtnClasses: string;

    let mobileNavOpen = false;
    function toggleMobileNav() {
        mobileNavOpen = !mobileNavOpen;
    }

    const satshootMobileLogoClass =
        'w-[100%] flex flex-row grow-1 gap-[10px] text-[24px] text-[#3b82f6] font-[800] justify-start items-center';

    const mobileNavMenuIconBtnClass =
        'transition-all ease duration-[0.3s] flex flex-col justify-center items-center ' +
        'p-[5px] outline outline-[1px] outline-[rgb(0,0,0,0.1)] rounded-[4px] hover:bg-[#3b82f6] hover:text-white';

    const mobileProfileBtnClass =
        'overflow-hidden w-[100%]  outline-[1px] outline-[rgb(0,0,0,0.1)]' +
        'transition ease-in-out duration-[0.3s] py-[6px] px-[12px] rounded-[6px] transform scale-100 ' +
        'whitespace-nowrap flex flex-row justify-start items-center gap-[8px] flex-grow-[1] hover:bg-[#3b82f6] hover:text-white ';
</script>

<div class="w-[100%] flex-col justify-center items-center hidden max-[576px]:flex">
    <div class="w-[100%] flex flex-row grow-1 gap-[10px] p-[10px] justify-center items-center">
        <div class={satshootMobileLogoClass}>
            <img src="/img/satshoot.svg" alt="satshoot logo" class="w-full max-w-[65px]" />
            <p>Satshoot</p>
        </div>
        <button on:click={toggleMobileNav} class={mobileNavMenuIconBtnClass}>
            <i class="bx bx-menu text-[32px]"></i>
        </button>
    </div>
    {#if mobileNavOpen}
        <div
            id="mobileNavContent"
            class="w-[100%] absolute top-0 bottom-0 left-0 right-0 z-20 bg-white flex flex-col"
        >
            <div
                class="w-[100%] flex flex-row grow-1 gap-[10px] p-[10px] justify-center items-center"
            >
                <div class={satshootMobileLogoClass}>
                    <img src="/img/satshoot.svg" alt="satshoot logo" class="w-full max-w-[65px]" />
                    <p>Satshoot</p>
                </div>
                <button on:click={toggleMobileNav} class={mobileNavMenuIconBtnClass}>
                    <i class="bx bx-menu text-[32px]"></i>
                </button>
            </div>
            <div
                class="w-[100%] border-t-[1px] border-t-[rgb(0,0,0,0.1)] px-[10px] py-[10px] flex flex-col gap-[10px]"
            >
                <div class="flex-grow flex flex-row gap-4 justify-end items-center flex-wrap">
                    <a href="/login" class={loginBtnClasses + ' flex-grow-[1]'}> Login </a>
                    <div
                        class="relative inline-block text-left justify-start items-start flex-grow-[1]"
                    >
                        <ProfileDropdown classes={mobileProfileBtnClass} />
                    </div>
                </div>
            </div>
            <div
                class="w-[100%] border-t-[1px] border-t-[rgb(0,0,0,0.1)] px-[10px] py-[10px] flex flex-col gap-[10px] overflow-auto"
            >
                <NavLinks />
            </div>
        </div>
    {/if}

    <!-- mobile nav end -->
</div>
