<script lang="ts">
    import { logout } from '$lib/utils/helpers';
    import Button from '../UI/Buttons/Button.svelte';
    import { loginMethod } from '$lib/stores/user';
    import { LoginMethod } from '$lib/stores/session';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    function confirmLogout() {
        isOpen = false;
        logout();
    }
</script>

<ModalWrapper bind:isOpen title="Confirm Logout">
    <div class="w-full flex flex-col">
        <!-- popups Logout start -->
        <div class="w-full py-[10px] px-[5px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                <p class="w-full">Do really you wish to log out?</p>
                {#if $loginMethod === LoginMethod.Local}
                    <div
                        class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                    >
                        <p class="font-[600] text-[16px] text-white">
                            Local Keypair will be deleted, make sure you have a backup!
                        </p>
                    </div>
                {/if}

                <Button fullWidth onClick={confirmLogout}>Confirm Logout</Button>
            </div>
        </div>
        <!-- popups Logout end -->
    </div>
</ModalWrapper>
