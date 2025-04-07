<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser, {
        currentUserFreelanceFollows,
        fetchFreelanceFollowEvent,
        freelanceFollowEvents,
    } from '$lib/stores/user';
    import {
        getRoboHashPicture,
        shortenTextWithEllipsesInMiddle,
    } from '$lib/utils/helpers';
    import { fetchEventFromRelaysFirst } from '$lib/utils/misc';
    import { filterValidPTags } from '$lib/utils/misc';
    import {
        NDKEvent,
        NDKKind,
        profileFromEvent,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
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
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    enum FollowStatus {
        isFollowing,
        beingFollowed,
        none,
    }

    const modalStore = getModalStore();
    const toaster = createToaster();

    interface Props {
        user: NDKUser;
        job?: TicketEvent | undefined;
    }

    let { user, job = undefined }: Props = $props();

    // State
    let userProfile = $state<NDKUserProfile | null>(null);
    let processingFollowEvent = $state(false);

    // Derived state
    const npub = $derived(user.npub);
    const profileHref = $derived('/' + npub);
    const avatarImage = $derived.by(() => {
        if (userProfile?.picture) {
            return userProfile.picture;
        }
        return getRoboHashPicture(user.pubkey)
    });
    const bech32ID = $derived(job ? job.encode() : '');
    const canEditProfile = $derived($currentUser && $currentUser?.pubkey === user.pubkey);
    const showMessageButton = $derived(!!job && job.pubkey !== $currentUser?.pubkey);

    const followStatus = $derived.by(() => {
        if (!$currentUserFreelanceFollows || !$freelanceFollowEvents || !$currentUser) {
            return FollowStatus.none;
        }

        // Check if current user is following this user
        const isFollowing = $currentUserFreelanceFollows.has(user.pubkey);
        if (isFollowing) {
            return FollowStatus.isFollowing;
        }

        // Check if this user is following current user
        const targetUserFollowEvent = $freelanceFollowEvents.get(user.pubkey);
        if (targetUserFollowEvent) {
            // list of all users whom target user is following
            const follows = filterValidPTags(targetUserFollowEvent.tags);
            // Update the status if target user is following current user
            // but current user is not following target user
            if (follows.includes($currentUser.pubkey)) {
                return FollowStatus.beingFollowed;
            }
        }

        return FollowStatus.none;
    });

    // Derived state for button text
    const followBtnText = $derived.by(() => {
        switch (followStatus) {
            case FollowStatus.isFollowing:
                return 'Un-Follow';
            case FollowStatus.beingFollowed:
                return 'Follow Back';
            default:
                return 'Follow';
        }
    });

    $effect(() => {
        if (user) {
            setProfile();
        }
    });

    $effect(() => {
        if (user.pubkey !== $currentUser?.pubkey) {
            fetchFreelanceFollowEvent(user.pubkey);
        }
    });

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
                toaster.success({
                    title: 'Followed!',
                });

                freelanceFollowEvents.update((map) => {
                    map.set($currentUser.pubkey, newFollowEvent);
                    return map;
                });
            })
            .catch((err) => {
                console.error(err);
                toaster.error({
                    title: 'Failed to publish follow event',
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
                toaster.success({
                    title: 'Un-followed!',
                });

                freelanceFollowEvents.update((map) => {
                    map.set($currentUser.pubkey, newFollowEvent);
                    return map;
                });
            })
            .catch((err) => {
                console.error(err);
                toaster.error({
                    title: 'Failed to publish follow event',
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
        const fallbackToCache = user.pubkey !== $currentUser?.pubkey;

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
            {
                relayTimeoutMS: 3000,
                fallbackToCache,
                explicitRelays:metadataRelays
            }
        );

        if (profile) {
            userProfile = profileFromEvent(profile);
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

    function handleEditProfile() {
        const currentPath = page.url.pathname;
        const profileSettingsUrl = new URL('/settings/profile', window.location.origin);
        profileSettingsUrl.searchParams.set('redirectPath', currentPath);
        goto(profileSettingsUrl);
    }

    let userInfoItems = $derived([
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
            href: userProfile?.website || '',
            isExternal: true,
            title: 'website address',
        },
    ]);

    const addressCopyBtnClasses =
        'bg-white dark:bg-brightGray rounded-[0px] border-l-[1px] border-l-black-100 hover:border-l-transparent ';
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
                        <ProfileImage src={userProfile?.picture || avatarImage} size="md" />
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
                            class="w-full flex flex-row overflow-hidden rounded-[4px] border-[1px] border-black-100 dark:border-white-100"
                        >
                            <div class="w-full flex flex-row">
                                <div class="w-full flex flex-row bg-black-50 overflow-auto">
                                    {#if href}
                                        <a
                                            {href}
                                            target={isExternal ? '_blank' : '_self'}
                                            class="anchor grow-1 px-[10px] py-[5px] whitespace-nowrap"
                                        >
                                            {text}
                                        </a>
                                    {:else}
                                        <p
                                            class="grow-1 px-[10px] py-[5px] text-start whitespace-nowrap"
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
                <div
                    class="w-full rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
                >
                    <ExpandableText text={userProfile.about} expandText="View Full About" />
                </div>
            {/if}
            <div class="w-full flex flex-col gap-[10px] rounded-[6px] p-[8px] bg-black-100">
                {#if canEditProfile}
                    <Button
                        variant="outlined"
                        classes="bg-white dark:bg-brightGray"
                        fullWidth
                        title="Edit Profile"
                        on:click={handleEditProfile}
                    >
                        <i class="bx bxs-edit-alt"></i>
                    </Button>
                {/if}

                {#if showMessageButton}
                    <Button
                        variant="outlined"
                        classes="bg-white dark:bg-brightGray"
                        fullWidth
                        href={'/messages/' + bech32ID}
                        title="Message (DM) user"
                        on:click={selectChatPartner}
                    >
                        <i class="bx bxs-conversation"></i>
                    </Button>
                {/if}
                <Button
                    variant="outlined"
                    classes="bg-white dark:bg-brightGray"
                    fullWidth
                    title="Share (Copy profile page link)"
                    on:click={handleShare}
                >
                    <i class="bx bxs-share-alt"></i>
                </Button>
            </div>
            <div class="w-full flex flex-col gap-[5px]">
                <div
                    class="w-full flex flex-row overflow-auto rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
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
                        <i class="bx bx-qr"></i>
                    </Button>
                    <CopyButton
                        text={user.npub}
                        feedbackMessage="npub copied!"
                        classes="rounded-[0] border-l-[1px]"
                    />
                </div>
                <div
                    class="w-full flex flex-row overflow-hidden rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
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
                        <i class="bx bx-qr"></i>
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
                            <ProgressRing />
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
