<script lang="ts">
    import DesktopNav from './DesktopNav.svelte';
    import MobileNav from './MobileNav.svelte';

    const loginBtnClasses =
        'transition ease-in-out duration-[0.3s] bg-[rgb(59,115,246)] py-[6px] px-[15px] rounded-[6px] ' +
        'text-white whitespace-nowrap flex flex-row justify-center items-center gap-[8px] hover:bg-blue-500';
</script>

<div class="w-full flex flex-col justify-center items-center gap-0 bg-unset">
    <DesktopNav {loginBtnClasses} />
    <MobileNav {loginBtnClasses} />
</div>
