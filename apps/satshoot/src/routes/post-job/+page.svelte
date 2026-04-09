<script lang="ts">
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import currentUser, {
        loggedIn,
        loginMethod,
        onBoarding,
        onBoardingName,
        onBoardingNsec,
    } from '$lib/stores/user';

    import {
        broadcastUserProfile,
        checkRelayConnections,
        initializeUser,
    } from '$lib/utils/helpers';

    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import { NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';

    import { jobToEdit } from '$lib/stores/job-to-edit';

    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';

    import tagOptions from '$lib/utils/tag-options';

    import { beforeNavigate, goto } from '$app/navigation';
    import { onMount, tick } from 'svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { page } from '$app/state';
    import { bytesToHex } from '@noble/ciphers/utils';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import CopyButton from '$lib/components/UI/Buttons/CopyButton.svelte';
    import ShareEventModal from '$lib/components/Modals/ShareEventModal.svelte';
    import { nip19 } from 'nostr-tools';
    import { showLoginModal } from '$lib/stores/modals';
    import {
        buildDraftFromExistingJob,
        buildUnsignedJobEvent,
        extensionContext,
        getEditableJobTags,
        repoJobDraft,
        withEmbedMode,
    } from '$lib/extensions/budabit';
    import { extensionHostBridge } from '$lib/extensions/host-bridge';

    class AccountPublishError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'AccountPublishError';
        }
    }

    class JobPublishError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'JobPublishError';
        }
    }

    let showShareModal = $state(false);

    let tagInput = $state('');
    let tagList = $state<string[]>([]);

    // For form validation
    const maxTags: number = 5;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    // reactive values bound to user input
    let titleText = $state('');
    let descriptionText = $state('');

    let posting = $state(false);
    let accountPostFailed = $state(false);
    let jobPostFailed = $state(false);

    let user: NDKUser | null = null;
    let job = $state<JobEvent>(new JobEvent($ndk));

    let step = $state(1);
    const embedMode = $derived(page.url.searchParams.get('embed'));
    const budabitEmbed = $derived(embedMode === 'budabit');
    const repoBoundDraft = $derived.by(() => {
        if ($repoJobDraft) return $repoJobDraft;
        if ($jobToEdit) return buildDraftFromExistingJob($jobToEdit, $extensionContext, embedMode);
        return null;
    });
    const canPublishViaHost = $derived(
        budabitEmbed && !!$extensionHostBridge && !!$extensionContext?.userPubkey
    );
    const waitingForBudabitSigner = $derived(budabitEmbed && !canPublishViaHost);

    let firstJob = $derived(
        !budabitEmbed && ($onBoarding === true || page.url.searchParams.get('state') === 'letsgo')
    );
    const allowPostJob = $derived(
        budabitEmbed ? canPublishViaHost : firstJob || (!!$currentUser && $loggedIn)
    );
    const loginActionLabel = $derived(budabitEmbed ? 'Waiting for Budabit Signer' : 'Log in To Post');
    const budabitSignerHelp = $derived.by(() => {
        if (!budabitEmbed) return '';
        if ($extensionContext?.repo?.repoName) {
            return 'Budabit repo context is loaded, but the current Budabit user pubkey has not arrived yet. Reload the repo tab if this stays stuck.';
        }
        return 'Waiting for Budabit to provide repo context and signer access.';
    });

    const { titleValid, titleState } = $derived.by(() => {
        if (titleText.length < minTitleLength) {
            return {
                titleValid: false,
                titleState: 'text-error-500',
            };
        }

        return {
            titleValid: true,
            titleState: 'text-black-500',
        };
    });

    const { descriptionValid, descriptionState } = $derived.by(() => {
        if (descriptionText.length < minTitleLength) {
            return {
                descriptionValid: false,
                descriptionState: 'text-error-500',
            };
        }

        return {
            descriptionValid: true,
            descriptionState: 'text-black-500',
        };
    });

    const validateJob = (): boolean => {
        if (!titleValid) {
            toaster.error({
                title: `Title must be minimum ${minTitleLength} characters!`,
            });
            return false;
        }

        if (!descriptionValid) {
            toaster.error({
                title: `Description must be minimum ${minDescriptionLength} characters!`,
            });
            return false;
        }

        return true;
    };

    const transformedTag = $derived(tagInput.length > 0 ? transFormTag(tagInput) : '');

    const sortedTagOptions = $derived(
        tagOptions.sort((a, b) => {
            if (a.label < b.label) return -1;
            if (a.label > b.label) return 1;
            return 0;
        })
    );

    const filteredTagOptions = $derived(
        tagInput.length > 0
            ? sortedTagOptions.filter((option) => option.value.includes(transformedTag))
            : []
    );
    // Always include the input tag as the first item, even if it's an exact match
    const displayOptions = $derived(
        transformedTag.length > 0
            ? [
                  { label: tagInput, value: transformedTag },
                  ...filteredTagOptions.filter((option) => option.value !== transformedTag),
              ]
            : filteredTagOptions
    );

    const tagRecommenderClasses =
        'w-full flex flex-row gap-[10px] rounded-[6px] ' +
        'border-[1px] border-black-100 dark:border-white-100 bg-black-50 flex-wrap ' +
        'p-[10px] max-h-[100px] overflow-y-scroll ';

    onMount(() => {
        if ($jobToEdit) {
            titleText = $jobToEdit.title;
            descriptionText = $jobToEdit.description;
            tagList = getEditableJobTags($jobToEdit.tags);
        } else if ($repoJobDraft) {
            titleText = $repoJobDraft.title;
            descriptionText = $repoJobDraft.description;
            tagList = [...$repoJobDraft.tags];
        }
        checkRelayConnections();
    });

    beforeNavigate(async () => {
        $jobToEdit = null;
    });

    function handleEnterKeyOnTagInput(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            addTag(tagInput);
        }
    }

    function addTag(tag: string) {
        if (tagList.length >= maxTags) {
            toaster.error({
                title: `Cannot add more than ${maxTags} tags!`,
            });

            return;
        }

        const transformedTag = transFormTag(tag);

        if (checkValidTag(transformedTag)) {
            tagList = [...tagList, transformedTag];
        }

        tagInput = '';
    }

    function removeTag(tag: string) {
        tagList = tagList.filter((item) => item !== tag);
    }

    function transFormTag(tagValue: string): string {
        tagValue = tagValue.replaceAll(' ', '_').toLowerCase();
        return tagValue;
    }

    function checkValidTag(tagValue: string): boolean {
        const occurrence = tagList.filter((tag: string) => tag === tagValue).length;

        const valid =
            !!tagValue &&
            /^[a-z0-9_\-\.]+$/i.test(tagValue) &&
            tagList.length <= maxTags &&
            occurrence === 0;

        if (!valid) {
            toaster.error({
                title: 'Invalid tag! Only letters and numbers, NO duplicates!',
            });
        }

        return valid;
    }

    const finalize = async () => {
        if (budabitEmbed && !canPublishViaHost) {
            toaster.error({
                title: 'Budabit signer not ready yet.',
                description: budabitSignerHelp,
            });
            return;
        }

        if (!validateJob()) return;

        posting = true;

        await tick();

        try {
            if (firstJob) {
                await finalizeAccount();
            }

            await postJob();

            onBoarding.set(false);
            onBoardingName.set('');
            onBoardingNsec.set('');

            step = 2;
        } catch (e) {
            if (e instanceof AccountPublishError) {
                accountPostFailed = true;
            } else if (e instanceof JobPublishError) {
                jobPostFailed = true;
            }
        } finally {
            posting = false;
        }
    };

    const finalizeAccount = async () => {
        try {
            $ndk.signer = new NDKPrivateKeySigner($onBoardingNsec);

            $loginMethod = LoginMethod.Local;

            $sessionPK = bytesToHex(
                nip19.decode($onBoardingNsec).data as Uint8Array<ArrayBufferLike>
            );

            user = await $ndk.signer.user();
            user.profile = {
                created_at: Math.floor(Date.now() / 1000),
                name: $onBoardingName,
                displayName: $onBoardingName,
                about: '',
                bio: '',
                lud16: '',
                website: '',
            };
            broadcastUserProfile($ndk, user);

            // initialize user
            initializeUser($ndk);

            toaster.success({
                title: 'Nostr Keypair Created!',
            });
        } catch (e) {
            console.error(e);
            toaster.error({
                title: 'Could not Post Account: ' + e,
            });
            throw new AccountPublishError('Publishing Account Failed');
        }
    };

    const postToHostBridge = async (
        unsignedEvent: ReturnType<typeof buildUnsignedJobEvent>
    ): Promise<void> => {
        if (!$extensionHostBridge) {
            throw new Error('Budabit host bridge is not available.');
        }

        const relays = Array.from(
            new Set([
                ...($extensionContext?.repo?.repoRelays || []),
                ...($extensionContext?.relays || []),
            ]),
        );

        const payload = relays.length > 0 ? { event: unsignedEvent, relays } : unsignedEvent;
        const result = await $extensionHostBridge.request('nostr:publish', payload);

        if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
            throw new Error(result.error);
        }

        await $extensionHostBridge
            .request('ui:toast', {
                message: $jobToEdit ? 'Updated SatShoot repo job' : 'Created SatShoot repo job',
                type: 'success',
            })
            .catch(() => {
                // pass
            });
    };

    async function postJob() {
        try {
            const existingDTag = ($jobToEdit?.tagValue('d') as string | undefined) || undefined;
            const unsignedEvent = buildUnsignedJobEvent({
                title: titleText,
                description: descriptionText,
                manualTags: tagList,
                repoDraft: repoBoundDraft,
                existingDTag,
                pubkey: canPublishViaHost ? $extensionContext?.userPubkey : undefined,
            });

            const nextJob = new JobEvent($ndk);
            nextJob.title = titleText;
            nextJob.description = descriptionText;
            nextJob.status = JobStatus.New;
            nextJob.tags = unsignedEvent.tags.map(tag => [...tag]);
            nextJob.created_at = unsignedEvent.created_at;
            nextJob.pubkey = unsignedEvent.pubkey || nextJob.pubkey;

            if (canPublishViaHost) {
                await postToHostBridge(unsignedEvent);
            } else {
                await nextJob.publishReplaceable();
            }

            job = nextJob;
            $repoJobDraft = null;

            // Navigate to profile page
            $profileTabStore = ProfilePageTabs.Jobs;
        } catch (e) {
            toaster.error({
                title: 'Could not post Job: ' + e,
            });
            throw new JobPublishError('Failed to post Job');
        }
    }

    function handleLogin() {
        $redirectAfterLogin = false;
        $showLoginModal = true;
    }

    async function handleSkip() {
        await finalizeAccount();

        onBoarding.set(false);
        onBoardingName.set('');
        onBoardingNsec.set('');

        // It's possible that user is coming from job page, he may want to post the bid
        // Therefor, we'll redirect the user to the job page
        if (!$redirectAfterLogin && window.history.length > 2) {
            // Navigate back to the previous page
            window.history.go(-2);
        }

        // When user don't want to publish the job Immediately, we'll redirect the user to services page
        goto('/services');
    }

    const jobTitleTooltip =
        '<div>' +
        '<div class="font-bold">' +
        'Make this short and to the point.' +
        '</div>' +
        '</div>';

    const tagsTooltip =
        '<div>' +
        '<div class="font-bold">' +
        'Keywords and technologies this Job is about.' +
        '</div>' +
        '</div>';

    const shareJobTooltip =
        '<div>' +
        '<div class="">' +
        'When you share on Nostr, SatShoot will re-share your post, so ' +
        'more people will see it.' +
        '</div>' +
        '</div>';

    const publishButtonLabel = $derived.by(() => {
        if (budabitEmbed && repoBoundDraft) return 'Post Repo Job via Budabit';
        if (budabitEmbed) return 'Post via Budabit';
        if (repoBoundDraft) return 'Post Repo Job';
        return 'Post on the Free Market';
    });

    const copyLinkTooltip =
        '<div>' +
        '<div class="">' +
        'This is a Nostr link to your job. Be careful where you share ' +
        'it! While your Nostr profile is not tied to your real name, if you ' +
        'share this on mainstream social media you will for ever link your ' +
        'account to your real identity!' +
        '</div>' +
        '</div>';
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-[10px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[10px] items-center">
                <div class="w-full flex flex-col gap-[5px]">
                    {#if firstJob}
                        <div class="w-full flex justify-center mt-2">
                            <img
                                src="/img/satshoot.svg"
                                alt="Satshoot logo"
                                class="w-14 sm:w-24 sm:justify-self-end"
                            />
                        </div>
                        <div class="w-full flex justify-center">
                            <h2 class="w-full h2 sm:h1 text-center">Welcome to SatShoot</h2>
                        </div>
                        <div class="flex justify-center text-center h4 sm:h3">
                            Where individuals become unstoppable
                        </div>
                        <div
                            class="flex flex-col items-center mt-4 text-xl sm:text-3xl text-center"
                        >
                            {#if step === 1}
                                {#if firstJob}
                                    <div
                                        class="w-[95vw] sm:w-[60vw] flex gap-x-2 gap-y-2 flex-wrap justify-center mb-2"
                                    >
                                        <Card>
                                            <div class="text-center text-lg sm:text-xl">Name:</div>
                                            <div class="text-center text-lg sm:text-xl">
                                                {$onBoardingName}
                                            </div>
                                        </Card>
                                    </div>
                                {/if}
                                <span> Great, let's see what You want to get solved: </span>
                            {/if}
                        </div>
                    {:else}
                        <h2 class="text-[40px] font-[500] text-center">
                            {repoBoundDraft ? ($jobToEdit ? 'Edit Repo Job' : 'New Repo Job') : $jobToEdit ? 'Edit' : 'New'} Job Post
                        </h2>
                    {/if}
                </div>
                {#if step === 1}
                    <Card classes="gap-[15px] w-[95vw] sm:w-[60vw]">
                        {#if repoBoundDraft}
                            <div class="grid gap-[10px] rounded-[8px] bg-black-50 p-[12px] dark:bg-black-100 sm:grid-cols-2">
                                <div class="flex flex-col gap-[4px]">
                                    <span class="text-[12px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                                        Repo Context
                                    </span>
                                    <span class="font-[600]">{repoBoundDraft.repoName || 'Repo-bound SatShoot job'}</span>
                                </div>
                                <div class="flex flex-col gap-[4px]">
                                    <span class="text-[12px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                                        Source
                                    </span>
                                    <span class="font-[600]">
                                        {repoBoundDraft.issueSubject || 'Custom repo job draft'}
                                    </span>
                                </div>
                            </div>
                        {/if}

                        {#if budabitEmbed}
                            <div class="rounded-[8px] border border-black-100 bg-black-50 p-[12px] dark:border-white-100 dark:bg-black-100">
                                <p class="text-[12px] font-[700] uppercase tracking-[0.08em] text-black-300 dark:text-white-300">
                                    Signing Mode
                                </p>
                                <p class="mt-[4px] text-[14px] font-[700] text-black-500 dark:text-white">
                                    {canPublishViaHost ? 'Budabit signer ready' : 'Budabit signer required'}
                                </p>
                                <p class="mt-[4px] text-[12px] text-black-300 dark:text-white-300">
                                    Repo jobs posted inside Budabit always publish with the Budabit signer, not the local SatShoot session.
                                </p>
                                {#if waitingForBudabitSigner}
                                    <p class="mt-[6px] text-[12px] text-yellow-700 dark:text-yellow-300">
                                        {budabitSignerHelp}
                                    </p>
                                {/if}
                            </div>
                        {/if}

                        <div class="flex flex-col gap-[5px]">
                            <div class="flex gap-x-2 items-center">
                                <label class="m-[0px] text-lg sm:text-xl" for="tile">
                                    Title (min. 10 chars)
                                </label>
                                <QuestionIcon
                                    extraClasses="text-[14px] p-[3px]"
                                    placement="bottom-start"
                                    popUpText={jobTitleTooltip}
                                />
                            </div>
                            <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                                <Input
                                    id="title"
                                    bind:value={titleText}
                                    placeholder="My Job"
                                    classes={titleState}
                                    fullWidth
                                />
                            </div>
                        </div>
                        <div class="flex flex-col gap-[5px]">
                            <label class="m-[0px] text-[14px]" for="description">
                                Description (min. 20 chars)
                            </label>
                            <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                                <Input
                                    id="description"
                                    bind:value={descriptionText}
                                    placeholder="Detailed description of your job/work/issue"
                                    classes="min-h-[100px] {descriptionState}"
                                    fullWidth
                                    textarea
                                    rows={6}
                                    minlength={minDescriptionLength}
                                />
                            </div>
                        </div>
                        <div class="">
                            <div class="flex flex-col gap-[5px]">
                                <div class="flex gap-x-2 items-center">
                                    <label class="m-[0px] text-lg sm:text-xl" for="tags">
                                        Tags
                                    </label>
                                    <QuestionIcon
                                        extraClasses="text-[14px] p-[3px]"
                                        placement="bottom-start"
                                        popUpText={tagsTooltip}
                                    />
                                </div>
                                <div
                                    class="flex flex-col gap-[10px] rounded-[6px] overflow-hidden bg-white dark:bg-brightGray"
                                >
                                    <Input
                                        bind:value={tagInput}
                                        placeholder="Search and add a tag, or add a custom tag"
                                        onKeyPress={handleEnterKeyOnTagInput}
                                        fullWidth
                                    />
                                    <div class={[tagRecommenderClasses, tagInput ? '' : 'hidden']}>
                                        {#each displayOptions as { label, value }}
                                            <Button
                                                classes="bg-black-200 dark:bg-white-200 text-black-500 dark:text-white hover:text-white p-[5px] font-400"
                                                onClick={() => addTag(value)}
                                            >
                                                <span class="pl-[10px]"> {label} </span>
                                                <span
                                                    class="flex flex-col items-center justify-center px-[10px] border-l-[1px] border-black-100 dark:border-white-100"
                                                >
                                                    <i class="bx bx-plus"></i>
                                                </span>
                                            </Button>
                                        {/each}
                                    </div>
                                </div>
                                <label class="m-[0px] text-lg sm:text-xl" for="added-tags">
                                    Added tags ({tagList.length}/{maxTags} max.)
                                </label>
                                <div
                                    class="flex flex-col gap-[10px] rounded-[6px] overflow-hidden bg-white dark:bg-brightGray"
                                >
                                    <div
                                        class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-black-100 dark:border-white-100 bg-black-50 flex-wrap p-[10px]"
                                    >
                                        {#each tagList as tag}
                                            <div
                                                class="flex flex-row rounded-[4px] bg-blue-500 text-white gap-[10px] overflow-hidden"
                                            >
                                                <span class="pl-[10px] py-[5px]">{tag}</span>
                                                <button
                                                    class="transition ease duration-[0.3s] text-white px-[10px] border-l-[1px] border-white-100 hover:bg-blue-500"
                                                    onclick={() => removeTag(tag)}
                                                    aria-label="remove tag"
                                                >
                                                    <i class="bx bx-x"></i>
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                {:else if step === 2}
                    <div class="flex flex-col items-center w-full">
                        <Card classes="w-[95vw] sm:w-[70vw]">
                            <div class="flex flex-col items-center gap-y-2 text-xl sm:text-2xl">
                                <div class="text-wrap">
                                    Congratulations, your Job is live on the <strong
                                        >free market</strong
                                    >!
                                </div>
                                <div class="text-wrap {!firstJob ? 'hidden' : ''}">
                                    You took the first step to become Unstoppable. Time to let
                                    people know.
                                </div>
                                <div class="w-full flex flex-wrap justify-between gap-y-2">
                                    <div class="flex gap-x-1 items-center">
                                        <Button onClick={() => (showShareModal = true)}>
                                            Share on Nostr
                                        </Button>
                                        <QuestionIcon
                                            extraClasses="text-[14px] p-[3px]"
                                            placement="bottom-start"
                                            popUpText={shareJobTooltip}
                                        />
                                    </div>
                                    <div class="flex gap-x-1 items-center">
                                        <CopyButton
                                            buttonText={'Copy Link'}
                                            text={`https://satshoot.com/${job!.encode()}`}
                                            feedbackMessage={'Link Copied!'}
                                        ></CopyButton>
                                        <QuestionIcon
                                            extraClasses="text-[14px] p-[3px]"
                                            placement="bottom-start"
                                            popUpText={copyLinkTooltip}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Button
                            classes="mt-4"
                            onClick={() =>
                                goto(withEmbedMode(`/${job!.encode()}`, embedMode))}
                        >
                            View Job
                        </Button>
                        {#if repoBoundDraft || embedMode === 'budabit'}
                            <Button
                                variant="outlined"
                                classes="mt-2"
                                onClick={() => goto(withEmbedMode('/repo-jobs', embedMode))}
                            >
                                Back to Repo Jobs
                            </Button>
                        {/if}
                    </div>
                {/if}
                <div class="w-full flex flex-row justify-center mt-[10px]">
                    {#if !allowPostJob}
                        {#if budabitEmbed}
                            <div class="flex w-full flex-col gap-3 sm:max-w-[60vw]">
                                <Button disabled>{loginActionLabel}</Button>
                                <p class="text-center text-[12px] text-black-300 dark:text-white-300">
                                    {budabitSignerHelp}
                                </p>
                                <Button
                                    variant="outlined"
                                    onClick={() => goto(withEmbedMode('/repo-jobs', embedMode))}
                                >
                                    Back to Repo Jobs
                                </Button>
                            </div>
                        {:else}
                            <Button onClick={handleLogin}>{loginActionLabel}</Button>
                        {/if}
                    {:else}
                        <div class="flex flex-col sm:max-w-[60vw] w-full gap-4">
                            <div class="w-full sm:max-w-[60vw] flex gap-x-4 justify-between">
                                {#if firstJob && step === 1}
                                    <Button
                                        grow
                                        variant="outlined"
                                        onClick={() => {
                                            goto(new URL('/letsgo', window.location.origin));
                                        }}
                                    >
                                        Back
                                    </Button>
                                {/if}
                                {#if step < 2}
                                    <Button
                                        grow
                                        onClick={finalize}
                                        disabled={posting}
                                        classes={'bg-yellow-500'}
                                    >
                                        {#if posting}
                                            <ProgressRing color="white" />
                                        {:else if jobPostFailed || accountPostFailed}
                                            <span>Try again</span>
                                        {:else}
                                            <span>{publishButtonLabel}</span>
                                        {/if}
                                    </Button>
                                {/if}
                            </div>
                            {#if repoBoundDraft && !firstJob}
                                <div class="w-full sm:max-w-[60vw] flex gap-x-4">
                                    <Button
                                        grow
                                        variant="outlined"
                                        onClick={() => goto(withEmbedMode('/repo-jobs', embedMode))}
                                    >
                                        Back to Repo Jobs
                                    </Button>
                                </div>
                            {/if}
                            {#if firstJob}
                                <div class="w-full sm:max-w-[60vw] flex gap-x-4">
                                    <Button grow variant="outlined" onClick={handleSkip}>
                                        Skip
                                    </Button>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<ShareEventModal
    firstTimerMessageTitle={!firstJob ? '' : "I've just published a Job on the free market.\n"}
    bind:isOpen={showShareModal}
    eventObj={job!}
/>
