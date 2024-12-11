<script lang="ts">
    import { loggedIn } from '$lib/stores/user';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import LogoutModal from '../Modals/LogoutModal.svelte';

    export let classes: string;

    const modalStore = getModalStore();

    let profileDropdownOpen = false;

    function toggleProfileDropdown() {
        profileDropdownOpen = !profileDropdownOpen;
    }

    function onLogout() {
        const modalComponent: ModalComponent = {
            ref: LogoutModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            title: 'Confirm log out',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    const profileMenuItems = [
        {
            href: '/',
            label: 'Text',
        },
    ];

    const profileDropdownWrapperClass =
        'dropdown-menu absolute right-0 z-10 mt-[5px] w-[100%] min-w-[150px] bg-white ' +
        'rounded-[6px] border-[1px] border-[rgb(0,0,0,0.1)] shadow-[0_0px_8px_rgba(0,0,0,0.1)]';

    const profileMenuItemClass =
        'transition-all ease duration-[0.2s] w-[100%] rounded-[4px] px-[8px] py-[4px] ' +
        'hover:bg-[rgb(59,115,246)] hover:text-white';
</script>

<button on:click={toggleProfileDropdown} class={classes}>
    <img src="/img/28bj7a.gif" alt="user profile" class="w-[25px] h-[25px] rounded-[100%]" />
    <span class="overflow-hidden whitespace-nowrap overflow-ellipsis max-w-[200px]">Username</span>
</button>
{#if profileDropdownOpen}
    <div class={profileDropdownWrapperClass}>
        <div class="p-[5px] flex flex-col" role="menu">
            {#each profileMenuItems as { href, label }}
                <a {href} class={profileMenuItemClass}>
                    {label}
                </a>
            {/each}

            {#if $loggedIn}
                <button class={profileMenuItemClass} on:click={onLogout}>Logout</button>
            {/if}
        </div>
    </div>
{/if}
