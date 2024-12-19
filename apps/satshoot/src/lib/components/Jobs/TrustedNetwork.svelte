<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import satShootWoT from '$lib/stores/satshoot-wot';
    import currentUser, { currentUserFreelanceFollows, loggedIn } from '$lib/stores/user';
    import { minWot, networkWoTScores } from '$lib/stores/wot';
    import { filterValidPTags, SatShootPubkey } from '$lib/utils/misc';
    import { NDKKind, NDKUser, type Hexpubkey } from '@nostr-dev-kit/ndk';
    import Avatar from '../Users/Avatar.svelte';
    import { nip19 } from 'nostr-tools';

    export let user: Hexpubkey;

    let followedBySatshootNetwork = new Set<Hexpubkey>();
    let followedByUserNetwork = new Set<Hexpubkey>();

    $: if (user) {
        $ndk.fetchEvents({
            kinds: [NDKKind.KindScopedFollow],
            '#k': [NDKKind.FreelanceTicket.toString(), NDKKind.FreelanceOffer.toString()],
            '#p': [user],
        }).then((events) => {
            const array1 = new Set<Hexpubkey>();
            const array2 = new Set<Hexpubkey>();

            events.forEach((event) => {
                if (satShootWoT.includes(event.pubkey)) {
                    // push pubkey to array1 which will be eventually assigned to followedBySatshootNetwork
                    array1.add(event.pubkey);
                }

                if (
                    $currentUser &&
                    ($currentUserFreelanceFollows?.has(event.pubkey) ||
                        ($networkWoTScores?.get(event.pubkey) || Number.NEGATIVE_INFINITY) >=
                            $minWot)
                ) {
                    // push pubkey to array2 which will be eventually assigned to followedByUserNetwork
                    array2.add(event.pubkey);
                }
            });

            followedBySatshootNetwork = array1;
            followedByUserNetwork = array2;
        });
    }

    // const followedBy =

    const profileImageWrapperClasses =
        'transition ease-in-out duration-[0.3s] min-w-[40px] min-h-[40px] w-[40px] h-[40px] ' +
        'rounded-full border-[3px] border-white shadow-[0_0_4px_2px_rgba(0,0,0,0.35)] ' +
        'flex flex-col justify-center items-center relative overflow-hidden bg-[rgba(255,255,255,0.2)] ' +
        'backdrop-blur-[10px] text-[12px] leading-[1] hover:border-[3px] hover:border-[rgb(59,130,246)] ' +
        'hover:scale-[1.1] hover:shadow-[0_0_4px_2px_rgba(0,0,0,0.1)]';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="flex flex-col gap-[15px]">
        <div class="flex flex-col gap-[15px]">
            <div class="">
                <p class="text-[14px] font-[600]">Trusted Network (Followed by):</p>
            </div>
            <div class="w-full flex flex-row gap-[5px]">
                <div
                    class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-[rgba(0,0,0,0.1)]"
                >
                    <a
                        class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                        href={'/' + SatShootPubkey + '/'}
                    >
                        <div class={profileImageWrapperClasses}>
                            <Avatar pubkey={SatShootPubkey} />
                        </div>
                    </a>
                </div>
                <div class="w-full flex flex-row flex-wrap">
                    {#each Array.from(followedBySatshootNetwork).slice(0, 5) as pubkey}
                        <a
                            class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center ml-0 hover:mr-[15px] hover:p-[0_10px] hover:pl-0"
                            href={'/' + nip19.npubEncode(pubkey) + '/'}
                        >
                            <div class={profileImageWrapperClasses}>
                                <Avatar {pubkey} />
                            </div>
                        </a>
                    {/each}

                    {#if followedBySatshootNetwork.size > 5}
                        <div
                            class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center text-[rgba(0,0,0,0.5)] font-[800] no-underline leading-[1] ml-[-15px] hover:ml-0 hover:mr-[15px] hover:p-[0_10px]"
                        >
                            <div class={profileImageWrapperClasses}>
                                <p>{followedBySatshootNetwork.size - 5}</p>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
            {#if $loggedIn && $currentUser}
                <div class="w-full flex flex-row gap-[5px]">
                    <div
                        class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-[rgba(0,0,0,0.1)]"
                    >
                        <a
                            class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                            href={'/' + $currentUser.npub + '/'}
                        >
                            <div class={profileImageWrapperClasses}>
                                <Avatar pubkey={$currentUser.pubkey} />
                            </div>
                        </a>
                    </div>
                    <div class="w-full flex flex-row flex-wrap">
                        {#each Array.from(followedByUserNetwork).slice(0, 5) as pubkey}
                            <a
                                class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center ml-0 hover:mr-[15px] hover:p-[0_10px] hover:pl-0"
                                href={'/' + nip19.npubEncode(pubkey) + '/'}
                            >
                                <div class={profileImageWrapperClasses}>
                                    <Avatar {pubkey} />
                                </div>
                            </a>
                        {/each}

                        {#if followedByUserNetwork.size > 5}
                            <div
                                class="transition-all ease-in-out duration-[0.3s] flex flex-col justify-center items-center text-[rgba(0,0,0,0.5)] font-[800] no-underline leading-[1] ml-[-15px] hover:ml-0 hover:mr-[15px] hover:p-[0_10px]"
                            >
                                <div class={profileImageWrapperClasses}>
                                    <p>{followedByUserNetwork.size - 5}</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
