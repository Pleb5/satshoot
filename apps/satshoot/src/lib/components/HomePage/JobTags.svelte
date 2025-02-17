<script lang="ts">
    const tags = [
        'Design',
        'Programming',
        'C++',
        'Game Designer',
        'UE5 Developer',
        'Marketing',
        'SFX Artist',
        'Vector Artist',
        'UX Designer',
        'Unity Developer',
    ];

    const tagLinkClasses =
        'transition-all ease duration-[0.3s] w-full relative p-[15px] rounded-[10px] bg-white ' +
        'border-[3px] border-white flex flex-col justify-center items-center gap-[25px] ' +
        'shadow-subtle text-black-500 font-[700] text-[18px] ' +
        'text-center hover:scale-[1.01] hover:shadow-deep hover:border-[3px] ' +
        'hover:border-blue-500 hover:no-underline dark:bg-gary-400 dark:text-white dark:border-white-100';

    const viewMoreBtnClasses =
        'transition-all ease duration-[0.3s] outline-0 p-[10px_20px] rounded-[5px] ' +
        'font-semibold text-[18px] transform scale-100 whitespace-nowrap flex flex-row ' +
        'justify-center items-center gap-[10px] bg-white-0 text-black-500 ' +
        'border-[1px] border-solid border-black-100 dark:border-white-100 w-full max-w-[200px] hover:bg-blue-500 ' +
        'hover:text-white hover:border-[1px_solid_transparent] hover:max-w-[225px] dark:text-white-500 dark:border-white-100';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div class="w-full flex flex-col gap-[15px]">
                <h2 class="text-[40px] font-[500]">Job Tags</h2>
                <p>Look for jobs that tag themselves with specific tags</p>
            </div>
            <div
                class="w-full grid grid-cols-5 gap-[25px] max-[992px]:grid-cols-4 max-[768px]:grid-cols-3 max-[576px]:grid-cols-2 max-[360px]:grid-cols-1"
            >
                {#each tags as tag}
                    <a class={tagLinkClasses} href="/">
                        <p
                            class="text-center display-[webkit-box] -webkit-box-orient-vertical overflow-hidden -webkit-line-clamp-1"
                        >
                            {tag}
                        </p>
                    </a>
                {/each}
            </div>
            <div class="w-full flex flex-row justify-center items-inherit gap-[15px]">
                <button type="button" class={viewMoreBtnClasses}> View more </button>
            </div>
        </div>
    </div>
</div>
