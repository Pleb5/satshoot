<script lang="ts">
    import { loggedIn } from '$lib/stores/user';
    import { createEventDispatcher } from 'svelte';
    import NavLinks from './NavLinks.svelte';
    import ProfileDropdown from './ProfileDropdown.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const dispatch = createEventDispatcher();

    let mobileNavOpen = false;
    function toggleMobileNav() {
        mobileNavOpen = !mobileNavOpen;
    }

    const satshootMobileLogoClass =
        'w-[100%] flex flex-row grow-1 gap-[10px] text-[24px] text-[#3b82f6] font-[800] justify-start items-center';
</script>

<div
    class="w-[100%] flex-col justify-center items-center hidden max-[576px]:flex"
    class:bg-white={mobileNavOpen}
>
    <div class="w-[100%] flex flex-row grow-1 gap-[10px] p-[10px] justify-center items-center">
        <div class={satshootMobileLogoClass}>
            <img src="/img/satshoot.svg" alt="satshoot logo" class="w-full max-w-[65px]" />
            <p>SatShoot</p>
        </div>
        <Button variant="outlined" classes="flex-col" on:click={toggleMobileNav}>
            <i class="bx bx-menu text-[32px]" />
        </Button>
    </div>
    {#if mobileNavOpen}
        <div class="w-[100%] h-screen bg-white flex flex-col">
            <div
                class="w-[100%] border-t-[1px] border-t-[rgb(0,0,0,0.1)] px-[10px] py-[10px] flex flex-col gap-[10px]"
            >
                {#if !$loggedIn}
                    <Button
                        grow
                        on:click={() => {
                            toggleMobileNav();
                            dispatch('login');
                        }}
                    >
                        Login
                    </Button>
                {:else}
                    <Button href="/post-job/" on:click={toggleMobileNav}>Submit Job Post</Button>
                    <div
                        class="relative inline-block text-left justify-start items-start flex-grow-[1]"
                    >
                        <ProfileDropdown classes="w-[100%]" on:click={toggleMobileNav} />
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
