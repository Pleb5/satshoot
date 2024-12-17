<script lang="ts">
    import { loggedIn } from '$lib/stores/user';
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
        'whitespace-nowrap flex flex-row justify-center items-center gap-[8px] flex-grow-[1] hover:bg-[#3b82f6] hover:text-white ';
</script>

<div
    class="w-[100%] flex-col justify-center items-center hidden max-[576px]:flex"
    class:bg-white={mobileNavOpen}
>
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
        <div class="w-[100%] h-screen bg-white flex flex-col">
            <div
                class="w-[100%] border-t-[1px] border-t-[rgb(0,0,0,0.1)] px-[10px] py-[10px] flex flex-col gap-[10px]"
            >
                {#if !$loggedIn}
                    <a
                        href="/login"
                        on:click={toggleMobileNav}
                        class={loginBtnClasses + ' flex-grow-[1]'}
                    >
                        Login
                    </a>
                {:else}
                    <div
                        class="relative inline-block text-left justify-start items-start flex-grow-[1]"
                    >
                        <ProfileDropdown
                            classes={mobileProfileBtnClass}
                            on:click={toggleMobileNav}
                        />
                    </div>
                {/if}
            </div>
            <div
                class="w-[100%] border-t-[1px] border-t-[rgb(0,0,0,0.1)] px-[10px] py-[10px] flex flex-col gap-[10px] overflow-auto"
            >
                <NavLinks on:click={toggleMobileNav} />
            </div>
        </div>
    {/if}

    <!-- mobile nav end -->
</div>
