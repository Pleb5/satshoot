<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser, {
        currentUserFreelanceFollows,
        fetchFreelanceFollowEvent,
        freelanceFollowEvents,
    } from '$lib/stores/user';
    import { fetchEventFromRelaysFirst, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import { filterValidPTags } from '$lib/utils/misc';
    import {
        NDKEvent,
        NDKKind,
        profileFromEvent,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import {
        clipboard,
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ModalComponent,
        type ModalSettings,
    } from '@skeletonlabs/skeleton';
    import { nip19 } from 'nostr-tools';
    import NewReputationCard from './NewReputationCard.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { selectedPerson } from '$lib/stores/messages';
    import ShareModal from '../Modals/ShareModal.svelte';
    import Card from '../UI/Card.svelte';

    enum FollowStatus {
        isFollowing,
        beingFollowed,
        none,
    }

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let user: NDKUser;
    export let job: TicketEvent | undefined = undefined;

    let userProfile: NDKUserProfile;
    let followBtnText = 'Follow';
    let followStatus = FollowStatus.none;

    $: npub = user.npub;
    $: profileHref = '/' + npub;
    $: avatarImage = `https://robohash.org/${user.pubkey}`;
    $: nip05 = userProfile?.nip05 || '';
    $: lud16 = userProfile?.lud16 || '';
    $: website = userProfile?.website || '';

    $: bech32ID = job ? job.encode() : '';

    let showMessageButton = false;
    $: if (job && job.pubkey !== $currentUser?.pubkey) {
        showMessageButton = true;
    } else {
        showMessageButton = false;
    }

    $: if (user) {
        setProfile();
    }

    $: if (user.pubkey !== $currentUser?.pubkey) {
        fetchFreelanceFollowEvent(user.pubkey);
    }

    $: if ($currentUserFreelanceFollows) {
        const isFollowing = $currentUserFreelanceFollows.has(user.pubkey);

        if (isFollowing) {
            followBtnText = 'Un-Follow';
            followStatus = FollowStatus.isFollowing;
        }
    }

    $: if ($freelanceFollowEvents.has(user.pubkey) && $currentUser) {
        if (followStatus !== FollowStatus.isFollowing) {
            const targetUserFollowEvent = $freelanceFollowEvents.get(user.pubkey)!;

            // list of all users whom target user is following
            const follows = filterValidPTags(targetUserFollowEvent.tags);

            const isFollowing = follows.includes($currentUser.pubkey);
            // Update the status if target user is following current user
            // but current user is not following target user
            if (isFollowing) {
                followBtnText = 'Follow Back';
                followStatus = FollowStatus.beingFollowed;
            }
        }
    }

    let processingFollowEvent = false;

    async function follow() {
        if (!$currentUser) return;

        processingFollowEvent = true;

        const followEvent = $freelanceFollowEvents.get($currentUser.pubkey);

        if (followEvent) {
            // publish delete event with reference to previous follow event
            const deleteEvent = new NDKEvent($ndk);
            deleteEvent.kind = NDKKind.EventDeletion;
            deleteEvent.tag(['e', followEvent.id]);
            deleteEvent.tag(['k', NDKKind.FreelanceTicket.toString()]);
            deleteEvent.tag(['k', NDKKind.FreelanceOffer.toString()]);
            deleteEvent.publish();
        }

        // create and publish a new follow event
        const newFollowEvent = new NDKEvent($ndk);
        newFollowEvent.kind ??= NDKKind.KindScopedFollow;
        newFollowEvent.tags = followEvent ? followEvent.tags : [];
        newFollowEvent.tag(['p', user.pubkey]);
        newFollowEvent.tag(['k', NDKKind.FreelanceTicket.toString()]);
        newFollowEvent.tag(['k', NDKKind.FreelanceOffer.toString()]);

        await newFollowEvent
            .publish()
            .then(() => {
                toastStore.trigger({
                    message: 'Followed!!!',
                    background: `bg-success-300-600-token`,
                    autohide: true,
                    timeout: 5000,
                });

                freelanceFollowEvents.update((map) => {
                    map.set($currentUser.pubkey, newFollowEvent);
                    return map;
                });
            })
            .catch((err) => {
                console.error(err);
                toastStore.trigger({
                    message: 'Failed to publish follow event',
                    background: `bg-error-300-600-token`,
                    autohide: true,
                    timeout: 5000,
                });
            })
            .finally(() => {
                processingFollowEvent = false;
            });
    }

    async function unFollow() {
        if (!$currentUser) return;
        const followEvent = $freelanceFollowEvents.get($currentUser.pubkey);

        if (!followEvent) return;

        processingFollowEvent = true;

        // publish delete event with reference to previous follow event
        const deleteEvent = new NDKEvent($ndk);
        deleteEvent.kind = NDKKind.EventDeletion;
        deleteEvent.tag(['e', followEvent.id]);
        deleteEvent.tag(['k', NDKKind.FreelanceTicket.toString()]);
        deleteEvent.tag(['k', NDKKind.FreelanceOffer.toString()]);
        deleteEvent.publish();

        // create and publish a new follow event
        const newFollowEvent = new NDKEvent($ndk);
        newFollowEvent.kind ??= NDKKind.KindScopedFollow;
        newFollowEvent.tags = followEvent.tags.filter(
            (tag) => tag[0] !== 'p' || tag[1] !== user.pubkey
        );

        await newFollowEvent
            .publish()
            .then(() => {
                toastStore.trigger({
                    message: 'Un-followed!!!',
                    background: `bg-success-300-600-token`,
                    autohide: true,
                    timeout: 5000,
                });

                freelanceFollowEvents.update((map) => {
                    map.set($currentUser.pubkey, newFollowEvent);
                    return map;
                });

                followBtnText = 'Follow';
                followStatus = FollowStatus.none;
            })
            .catch((err) => {
                console.error(err);
                toastStore.trigger({
                    message: 'Failed to publish follow event',
                    background: `bg-error-300-600-token`,
                    autohide: true,
                    timeout: 5000,
                });
            })
            .finally(() => {
                processingFollowEvent = false;
            });
    }

    async function setProfile() {
        // Logged in user's metadata MUST be fetched from relays
        // to avoid metadata edit from stale state
        // Otherwise we can fall back to cache
        const fallBackToCache = user.pubkey !== $currentUser?.pubkey;

        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [user.pubkey],
        };

        const metadataRelays = [
            ...$ndk.outboxPool!.connectedRelays(),
            ...$ndk.pool!.connectedRelays(),
        ];

        const profile = await fetchEventFromRelaysFirst(
            metadataFilter,
            3000,
            fallBackToCache,
            metadataRelays
        );

        if (profile) {
            userProfile = profileFromEvent(profile);
            if (userProfile.image) {
                avatarImage = userProfile.image;
            }
        }
    }

    function selectChatPartner() {
        $selectedPerson = job!.pubkey + '$' + bech32ID;
    }

    function handleShare() {
        const modalComponent: ModalComponent = {
            ref: ShareModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    $: userInfoItems = [
        {
            text: nip05,
            href: profileHref,
            isExternal: false,
            title: 'Verified',
            iconClass: 'bx bxs-badge-check',
            hoverColor: 'rgb(225,255,225,0.75)',
        },
        {
            text: lud16,
            title: 'Zap',
            iconClass: 'bx bxs-bolt',
            hoverColor: 'rgb(250,250,0,0.75)',
        },
        {
            text: website,
            href: website,
            isExternal: true,
            title: 'Website',
            iconClass: 'bx bx-globe',
            hoverColor: 'rgb(225,255,225,0.75)',
        },
    ];

    const profileLinkClasses =
        'transition transition-ease duration-[0.3s] transform w-[55px] h-[55px] min-w-[55px] min-h-[55px] ' +
        'overflow-hidden relative rounded-[100%] shadow-[0_0_4px_4px_rgba(0,0,0,0.5)] bg-[rgb(0,0,0,0.1)] ' +
        'outline outline-[4px] outline-[rgb(255,255,255)] hover:outline-[rgb(59,115,246)] hover:scale-[1.02] ' +
        'transform w-[75px] h-[75px] min-w-[75px] min-h-[75px] shadow-[0_0_8px_4px_rgba(0,0,0,0.5)] hover:scale-[1.03]';

    const btnClasses =
        'transition ease duration-[0.3s] outline outline-[1px] outline-[rgb(0,0,0,0.1)] py-[6px] px-[12px] ' +
        'rounded-[6px] transform whitespace-nowrap flex flex-row justify-center items-center gap-[8px] font-[600] ' +
        'text-[rgb(255,255,255,0.5)] bg-[rgb(59,115,246)] hover:bg-[#3b82f6] hover:text-white';

    const iconBtnClasses =
        'flex flex-row justify-center items-center px-[10px] py-[5px] text-[18px] ' +
        'text-[rgb(0,0,0,0.25)] bg-[rgb(0,0,0,0.1)] group-hover:bg-[rgb(225,255,225,0.1)]';

    const copyBtnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[15px] rounded-[0px] ' +
        'text-[rgb(0,0,0,0.25)] hover:text-white hover:bg-[#3b73f6]';

    const actionBtnClasses =
        'transition ease duration-[0.3s] px-[15px] py-[10px] bg-[rgb(255,255,255)] ' +
        'text-[rgb(0,0,0,0.35)] rounded-[4px] hover:bg-[rgb(59,115,246)] hover:text-white';

    const addressCopyBtnClasses =
        'transition-all ease duration-[0.3s] bg-white py-[5px] px-[15px] rounded-[0px] text-[rgb(0,0,0,0.25)] ' +
        'border-l-[1px] border-l-[rgb(0,0,0,0.1)] hover:border-l-[rgb(0,0,0,0.0)] hover:text-white hover:bg-[#3b73f6]';
</script>

<div class="w-full max-w-[350px] flex flex-col gap-[25px] max-[768px]:max-w-full">
    <div class="w-full flex flex-col gap-[15px] max-[768px]:mt-[15px]">
        <!-- profile section -->
        <Card classes="gap-[15px]">
            <div class="w-full flex flex-col">
                <div
                    class="w-full overflow-hidden relative rounded-[6px] shadow-[0_0_4px_0_rgb(0,0,0,0.1)] bg-[rgb(0,0,0,0.1)] pt-[25%]"
                >
                    <img
                        class="w-full h-full absolute inset-0 object-cover"
                        src={userProfile?.banner || avatarImage}
                        alt="banner"
                    />
                </div>
                <div class="w-full mt-[-35px] flex flex-col justify-center items-center">
                    <a href={profileHref} class={profileLinkClasses}>
                        <img
                            class="w-full h-full absolute inset-0 object-cover"
                            src={userProfile?.image || avatarImage}
                            alt="profile"
                        />
                    </a>
                </div>
            </div>
            <div class="flex flex-col gap-[10px]">
                <a href={profileHref} class="font-[600]">
                    {userProfile?.name ??
                        userProfile?.displayName ??
                        shortenTextWithEllipsesInMiddle(npub, 15)}
                </a>

                {#each userInfoItems as { text, href, isExternal, title, hoverColor, iconClass }}
                    <div
                        class="w-full flex flex-row overflow-hidden rounded-[4px] border-[1px] border-[rgb(0,0,0,0.1)]"
                    >
                        <div
                            class="transition ease duration-[0.3s] w-full flex flex-row bg-[white] hover:bg-[rgb(59,115,246)] hover:text-white group"
                        >
                            <div class="w-full flex flex-row bg-[rgb(0,0,0,0.05)]">
                                {#if href}
                                    <a
                                        {href}
                                        target={isExternal ? '_blank' : '_self'}
                                        class="grow-[1] px-[10px] py-[5px] overflow-hidden whitespace-nowrap overflow-ellipsis"
                                    >
                                        {text}
                                    </a>
                                    <div
                                        {title}
                                        class="{iconBtnClasses} group-hover:text-[{hoverColor}]"
                                    >
                                        <i class={iconClass} />
                                    </div>
                                {:else}
                                    <button
                                        class="grow-[1] px-[10px] py-[5px] text-start overflow-hidden whitespace-nowrap overflow-ellipsis"
                                    >
                                        {text}
                                    </button>
                                    <button
                                        {title}
                                        class="{iconBtnClasses} group-hover:text-[{hoverColor}]"
                                    >
                                        <i class="bx bxs-bolt" />
                                    </button>
                                {/if}

                                <button class={copyBtnClasses} use:clipboard={text}>
                                    <i class={iconClass} />
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
            {#if userProfile?.about}
                <div class="w-full rounded-[6px] border-[1px] border-[rgb(0,0,0,0.15)]">
                    <ExpandableText text={userProfile.about} expandText="View Full About" />
                </div>
            {/if}
            <div
                class="w-full flex flex-row gap-[4px] rounded-[6px] overflow-hidden bg-[rgb(0,0,0,0.1)] flex-wrap p-[4px]"
            >
                {#if showMessageButton}
                    <a
                        href={'/messages/' + bech32ID}
                        on:click={selectChatPartner}
                        title="Message (DM) user"
                        class="{actionBtnClasses} w-full flex justify-center"
                    >
                        <i class="bx bxs-conversation" />
                    </a>
                {/if}

                <button
                    title="Share (Copy profile page link)"
                    class="{actionBtnClasses} grow-[1]"
                    on:click={handleShare}
                >
                    <i class="bx bxs-share-alt" />
                </button>
                <!-- <button title="Block user" class="{actionBtnClasses} grow-[1]">
                    <i class="bx bx-block" />
                </button>
                <button title="Report user" class="{actionBtnClasses} grow-[1]">
                    <i class="bx bx-error" />
                </button> -->
            </div>
            <div class="w-full flex flex-col gap-[5px]">
                <div
                    class="w-full flex flex-row overflow-hidden rounded-[6px] border-[1px] border-[rgb(0,0,0,0.15)]"
                >
                    <input
                        readonly
                        class="w-full border-[0px] border-[rgb(0,0,0,0.15)] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0.05)]"
                        type="text"
                        placeholder="nPubAddress"
                        value={user.npub}
                    />
                    <button class={addressCopyBtnClasses}>
                        <i class="bx bx-qr" />
                    </button>
                    <button class={addressCopyBtnClasses} use:clipboard={user.npub}>
                        <i class="bx bxs-copy" />
                    </button>
                </div>
                <div
                    class="w-full flex flex-row overflow-hidden rounded-[6px] border-[1px] border-[rgb(0,0,0,0.15)]"
                >
                    <input
                        readonly
                        class="w-full border-[0px] border-[rgb(0,0,0,0.15)] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0.05)]"
                        type="text"
                        placeholder="nProfileAddress"
                        value={nip19.nprofileEncode({ pubkey: user.pubkey })}
                    />
                    <button class={addressCopyBtnClasses}>
                        <i class="bx bx-qr" />
                    </button>
                    <button
                        class={addressCopyBtnClasses}
                        use:clipboard={nip19.nprofileEncode({ pubkey: user.pubkey })}
                    >
                        <i class="bx bxs-copy" />
                    </button>
                </div>
            </div>
            {#if $currentUser && $currentUser.npub !== npub}
                <div class="flex flex-col gap-[10px]">
                    <button
                        class={btnClasses}
                        on:click={followStatus === FollowStatus.isFollowing ? unFollow : follow}
                    >
                        {#if processingFollowEvent}
                            <ProgressRadial
                                value={undefined}
                                stroke={60}
                                meter="stroke-tertiary-500"
                                track="stroke-tertiary-500/30"
                                strokeLinecap="round"
                                width="w-8"
                            />
                        {:else}
                            {followBtnText}
                        {/if}
                    </button>
                </div>
            {/if}
        </Card>
        <!-- reputation -->
        <NewReputationCard user={user.pubkey} forUserCard />
    </div>
</div>
