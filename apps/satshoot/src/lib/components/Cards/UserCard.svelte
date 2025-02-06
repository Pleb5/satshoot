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
    import ReputationCard from './ReputationCard.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { selectedPerson } from '$lib/stores/messages';
    import ShareModal from '../Modals/ShareModal.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import CopyButton from '../UI/Buttons/CopyButton.svelte';
    import QrCodeModal from '../Modals/QRCodeModal.svelte';

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
                    message: 'Followed!',
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
                    message: 'Un-followed!',
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
            text: userProfile?.nip05,
            href: profileHref,
            isExternal: false,
            title: 'nip05',
        },
        {
            text: userProfile?.lud16,
            title: 'Lightning address',
        },
        {
            text: userProfile?.website,
            href: website,
            isExternal: true,
            title: 'website address',
        },
    ];

    const addressCopyBtnClasses =
        'bg-white rounded-[0px] border-l-[1px] border-l-black-100 hover:border-l-transparent ';
</script>

<div class="w-full max-w-[350px] flex flex-col gap-[25px] max-[768px]:max-w-full">
    <div class="w-full flex flex-col gap-[15px] max-[768px]:mt-[15px]">
        <!-- profile section -->
        <Card classes="gap-[15px]">
            <div class="w-full flex flex-col">
                <div
                    class="w-full overflow-hidden relative rounded-[6px] shadow-subtle bg-black-100 pt-[25%]"
                >
                    <img
                        class="w-full h-full absolute inset-0 object-cover"
                        src={userProfile?.banner || avatarImage}
                        alt="banner"
                    />
                </div>
                <div class="w-full mt-[-35px] flex flex-col justify-center items-center">
                    <a href={profileHref}>
                        <ProfileImage src={userProfile?.image || avatarImage} size="md" />
                    </a>
                </div>
            </div>
            <div class="flex flex-col gap-[10px]">
                <a href={profileHref} class="font-[600]">
                    {userProfile?.name ??
                        userProfile?.displayName ??
                        shortenTextWithEllipsesInMiddle(npub, 15)}
                </a>

                {#each userInfoItems as { text, href, isExternal, title }}
                    {#if text}
                        <div
                            class="w-full flex flex-row overflow-hidden rounded-[4px] border-[1px] border-black-100"
                        >
                            <div class="w-full flex flex-row">
                                <div class="w-full flex flex-row bg-black-50">
                                    {#if href}
                                        <a
                                            {href}
                                            target={isExternal ? '_blank' : '_self'}
                                            class="grow-[1] px-[10px] py-[5px] overflow-hidden whitespace-nowrap overflow-ellipsis"
                                        >
                                            {text}
                                        </a>
                                    {:else}
                                        <p
                                            class="grow-[1] px-[10px] py-[5px] text-start overflow-hidden whitespace-nowrap overflow-ellipsis"
                                        >
                                            {text}
                                        </p>
                                    {/if}
                                </div>
                                <CopyButton
                                    {text}
                                    feedbackMessage={title + ' copied!'}
                                    classes="rounded-[0] border-l-[1px]"
                                />
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
            {#if userProfile?.about}
                <div class="w-full rounded-[6px] border-[1px] border-black-200">
                    <ExpandableText text={userProfile.about} expandText="View Full About" />
                </div>
            {/if}
            <div
                class="w-full flex flex-row gap-[4px] rounded-[6px] overflow-hidden bg-black-100 flex-wrap p-[4px]"
            >
                {#if showMessageButton}
                    <Button
                        variant="outlined"
                        classes="bg-white"
                        fullWidth
                        href={'/messages/' + bech32ID}
                        title="Message (DM) user"
                        on:click={selectChatPartner}
                    >
                        <i class="bx bxs-conversation" />
                    </Button>
                {/if}
                <Button
                    variant="outlined"
                    classes="bg-white"
                    fullWidth
                    title="Share (Copy profile page link)"
                    on:click={handleShare}
                >
                    <i class="bx bxs-share-alt" />
                </Button>
            </div>
            <div class="w-full flex flex-col gap-[5px]">
                <div
                    class="w-full flex flex-row overflow-hidden rounded-[6px] border-[1px] border-black-200"
                >
                    <Input value={user.npub} placeholder="npub..." fullWidth disabled noBorder />
                    <Button
                        variant="outlined"
                        classes={addressCopyBtnClasses}
                        on:click={() => {
                            modalStore.trigger({
                                type: 'component',
                                component: {
                                    ref: QrCodeModal,
                                    props: { title: "User's Npub", data: user.npub },
                                },
                            });
                        }}
                    >
                        <i class="bx bx-qr" />
                    </Button>
                    <CopyButton
                        text={user.npub}
                        feedbackMessage="npub copied!"
                        classes="rounded-[0] border-l-[1px]"
                    />
                </div>
                <div
                    class="w-full flex flex-row overflow-hidden rounded-[6px] border-[1px] border-black-200"
                >
                    <Input
                        value={nip19.nprofileEncode({ pubkey: user.pubkey })}
                        placeholder="nprofile1..."
                        fullWidth
                        disabled
                        noBorder
                    />
                    <Button
                        variant="outlined"
                        classes={addressCopyBtnClasses}
                        on:click={() => {
                            modalStore.trigger({
                                type: 'component',
                                component: {
                                    ref: QrCodeModal,
                                    props: {
                                        title: "User's Profile Address",
                                        data: nip19.nprofileEncode({ pubkey: user.pubkey }),
                                    },
                                },
                            });
                        }}
                    >
                        <i class="bx bx-qr" />
                    </Button>
                    <CopyButton
                        text={nip19.nprofileEncode({ pubkey: user.pubkey })}
                        feedbackMessage="profile address copied!"
                        classes="rounded-[0] border-l-[1px]"
                    />
                </div>
            </div>
            {#if $currentUser && $currentUser.npub !== npub}
                <div class="flex flex-col gap-[10px]">
                    <Button
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
                    </Button>
                </div>
            {/if}
        </Card>
        <!-- reputation -->
        <ReputationCard user={user.pubkey} forUserCard />
    </div>
</div>
