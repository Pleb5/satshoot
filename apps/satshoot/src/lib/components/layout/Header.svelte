<script lang="ts">
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import DesktopNav from './DesktopNav.svelte';
    import MobileNav from './MobileNav.svelte';
    import LoginModal from '../Modals/LoginModal.svelte';

    const modalStore = getModalStore();

    function handleLogin() {
        const modalComponent: ModalComponent = {
            ref: LoginModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }
</script>

<div class="w-full flex flex-col justify-center items-center gap-0 bg-unset">
    <DesktopNav on:login={handleLogin} />
    <MobileNav on:login={handleLogin} />
</div>
