<script lang="ts">
    export let src: string;

    const wrapperClasses =
        'transition-all ease-in-out duration-[0.3s] min-w-[50px] min-h-[50px] w-[50px] h-[50px] ' +
        'rounded-full border-[4px] border-white shadow-[0_0_4px_2px_rgba(0,0,0,0.15)] ' +
        'flex flex-col justify-center items-center relative overflow-hidden bg-white-200';
</script>

<div class={wrapperClasses}>
    <img class="w-full h-full absolute top-0 bottom-0 right-0 left-0 object-cover" {src} alt="" />
</div>
