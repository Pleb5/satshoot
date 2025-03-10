<script lang="ts">
    import { loggedIn } from '$lib/stores/user';
    import { createEventDispatcher } from 'svelte';
    import ProfileDropdown from './ProfileDropdown.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const dispatch = createEventDispatcher();

    const satShootLogoWrapperClass =
        'flex-grow flex flex-row gap-4 justify-end items-center flex-wrap ' +
        'max-w-[250px] w-full max-[576px]:max-w-full max-[576px]:justify-center max-[576px]:items-center';

    const satShootLogoClass =
        'transition ease-in-out duration-[0.3s] w-full ' +
        'flex flex-row justify-start items-center relative gap-4 text-[20px] ' +
        'text-[#3b82f6] font-[800] hover:text-blue-500 hover:no-underline max-[576px]:justify-center';
</script>

<div class="hidden sm:flex flex-col justify-center items-center w-full">
    <div
        class="w-full flex flex-col items-center border-b border-b-black-100 py-[10px] dark:border-b-white-100"
    >
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-row gap-6 flex-wrap">
                <div class={satShootLogoWrapperClass}>
                    <a href="/" class={satShootLogoClass}>
                        <img
                            src="/img/satshoot.svg"
                            alt="Satshoot logo"
                            class="w-full max-w-[45px]"
                        />
                        <p>SatShoot</p>
                    </a>
                </div>
                <div class="flex-grow flex flex-row gap-4 justify-end items-center flex-wrap">
                    {#if !$loggedIn}
                        <Button on:click={() => dispatch('login')}>Login</Button>
                    {/if}

                    {#if $loggedIn}
                        <Button href="/post-job/">Submit Job Post</Button>
                    {/if}

                    <div class="relative inline-block text-left max-w-[250px]">
                        <ProfileDropdown />
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
