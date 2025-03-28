<script lang="ts">
    const items = [
        {
            icon: 'bxs-star',
            title: 'Unstoppable Reputation',
            description: 'SatShoot can never delete your data or censor you.',
            hoverText: 'Your identity and data is portable across the Nostr app-universe.',
        },
        {
            icon: 'bxs-lock',
            title: 'User Control',
            description: 'SatShoot cannot stop You from getting a deal.',
            hoverText: 'You can switch to another app at any time you like.',
        },
        {
            icon: 'bxs-check-shield',
            title: 'Trust your own Network',
            description: 'Only engage with your cryptographically verified Web of Trust (WoT).',
            hoverText:
                'Exclude bad actors based on your follows, mutes and reports across all ' +
                'nostr-apps<br /><br />Select the best clients and freelancers based on ' +
                'reviews and other metrics.<br />',
        },
        {
            icon: 'bx-money',
            title: 'Instant and Final Payments',
            description: 'Pay and earn sats using Cashu and the Lightning network.',
            hoverText: 'Instant, direct payments. No charge back risk.<br />',
        },
    ];

    const itemWrapperClasses =
        'transition-all ease duration-[0.4s] grow w-0 bg-white dark:bg-brightGray p-[25px_15px] ' +
        'shadow-subtle gap-[25px] flex flex-col justify-center ' +
        'items-center rounded-[10px] relative overflow-hidden min-h-[175px] min-w-[200px] ' +
        'hover:bg-blue-500 hover:text-white hover:scale-[1.02] group';

    const itemHoverClasses =
        'ease duration-[0.4s] transition-[padding_1s_0s,height_1s_0s] ' +
        'absolute top-0 bottom-0 right-0 left-0 bg-black-500 ' +
        'backdrop-blur-[10px] text-white flex flex-col justify-center items-center text-center ' +
        'h-0 overflow-hidden group-hover:ease group-hover:duration-[0.4s] group-hover:delay-500 ' +
        'group-hover:transition-[padding_1s_0.4s,height_1s_0.4s] group-hover:p-[25px] group-hover:h-full';
</script>

<div class="w-full flex flex-col justify-center items-center py-[50px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
            <div class="w-full flex flex-row gap-[25px] flex-wrap">
                {#each items as item}
                    <div class={itemWrapperClasses}>
                        <i
                            class={`bx ${item.icon} transition-all ease duration-[0.4s] text-[48px] text-center text-blue-500 group-hover:text-white`}
                        ></i>
                        <p class="text-center font-bold">{item.title}</p>
                        <p class="text-center mt-[-10px]">
                            {item.description}
                        </p>
                        <div class={itemHoverClasses}>
                            <p>
                                {@html item.hoverText}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>
