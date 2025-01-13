<script lang="ts">
    import { loggedIn } from '$lib/stores/user';
    import { createEventDispatcher } from 'svelte';
    import NavLinks from './NavLinks.svelte';
    import ProfileDropdown from './ProfileDropdown.svelte';

    export let loginBtnClasses: string;

    const dispatch = createEventDispatcher();

    const satShootLogoWrapperClass =
        'flex-grow flex flex-row gap-4 justify-end items-center flex-wrap ' +
        'max-w-[250px] w-full max-[576px]:max-w-full max-[576px]:justify-center max-[576px]:items-center';

    const satShootLogoClass =
        'transition ease-in-out duration-[0.3s] w-full ' +
        'flex flex-row justify-start items-center relative gap-4 text-[24px] ' +
        'text-[#3b82f6] font-[800] hover:text-blue-500 hover:no-underline max-[576px]:justify-center';

    const profileBtnClasses =
        'transition ease-in-out duration-[0.3s] outline outline-[1px] ' +
        'outline-[rgb(0,0,0,0.1)] py-[6px] px-[12px] rounded-[6px] transform scale-100 ' +
        'whitespace-nowrap flex flex-row justify-center items-center gap-[8px] hover:bg-[#3b82f6] hover:text-white';

    const jobPostBtnClasses =
        'transition ease-in-out duration-[0.3s] bg-[rgb(59,115,246)] py-[6px] px-[15px] rounded-[6px] ' +
        'text-white whitespace-nowrap flex flex-row justify-center items-center gap-[8px] hover:bg-blue-500';
</script>

<div class="w-full flex flex-col justify-center items-center max-[576px]:hidden">
    <!-- first nav part start -->
    <div class="w-full flex flex-col items-center border-b border-b-[rgba(0,0,0,0.1)] py-[10px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-row gap-6 flex-wrap">
                <div class={satShootLogoWrapperClass}>
                    <a href="/" class={satShootLogoClass}>
                        <img
                            src="/img/satshoot.svg"
                            alt="Satshoot logo"
                            class="w-full max-w-[65px]"
                        />
                        <p>Satshoot</p>
                    </a>
                </div>
                <div class="flex-grow flex flex-row gap-4 justify-end items-center flex-wrap">
                    {#if !$loggedIn}
                        <button class={loginBtnClasses} on:click={() => dispatch('login')}>
                            Login
                        </button>
                    {/if}

                    {#if $loggedIn}
                        <a href="/post-job/" class={jobPostBtnClasses}>Submit Job Post</a>
                    {/if}

                    <div class="relative inline-block text-left max-w-[250px]">
                        <ProfileDropdown classes={profileBtnClasses} />
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- first nav part end -->

    <!-- second nav part start -->
    <div class="w-full flex flex-col items-center border-b border-b-[rgba(0,0,0,0.1)] py-[5px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-row gap-[10px] flex-wrap justify-center items-center">
                <NavLinks />
            </div>
        </div>
    </div>
    <!-- second nav part end -->
</div>
