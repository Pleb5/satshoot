<script lang="ts">
    interface Props {
        src: string;
        size?: 'xs' | 'sm' | 'md' | 'lg'; // Default to "sm"
    }

    let { src, size = 'sm' }: Props = $props();

    const sizeClasses = {
        xs: 'w-[35px] h-[35px] min-w-[35px] min-h-[35px]',
        sm: 'w-[50px] h-[50px] min-w-[50px] min-h-[50px]',
        md: 'w-[75px] h-[75px] min-w-[75px] min-h-[75px]',
        lg: 'w-[100px] h-[100px] min-w-[100px] min-h-[100px]',
    };

    const baseClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-col ' +
        'justify-center items-center relative overflow-hidden bg-white-200 ' +
        'rounded-full border-[4px] border-white shadow-strong ' +
        'ring-4 ring-white hover:ring-blue-500 hover:scale-[1.02] ';

    let wrapperClasses = $derived(baseClasses + sizeClasses[size]);
</script>

<div class={wrapperClasses}>
    <img class="w-full h-full absolute top-0 bottom-0 right-0 left-0 object-cover" {src} alt="" />
</div>
