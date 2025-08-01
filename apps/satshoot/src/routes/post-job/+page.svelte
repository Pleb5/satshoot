<script lang="ts">
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import currentUser, { loggedIn, loginMethod, onBoarding, onBoardingName, onBoardingNsec, onBoardingPrivateKey } from '$lib/stores/user';
    import { broadcastUserProfile, checkRelayConnections, initializeUser } from '$lib/utils/helpers';

    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import { NDKPrivateKeySigner, NDKUser, type NDKTag } from '@nostr-dev-kit/ndk';

    import { jobToEdit } from '$lib/stores/job-to-edit';

    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';

    import tagOptions from '$lib/utils/tag-options';

    import { beforeNavigate, goto } from '$app/navigation';
    import { onMount, tick } from 'svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { page } from '$app/state';
    import { bytesToHex } from '@noble/ciphers/utils';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import CopyButton from '$lib/components/UI/Buttons/CopyButton.svelte';
    import ShareEventModal from '$lib/components/Modals/ShareEventModal.svelte';

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

    let showLoginModal = $state(false);
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

    let user: NDKUser|null = null;
    let job = $state<JobEvent|null>(null);

    let step = $state(1);

    let firstJob = $derived(
        $onBoarding === true
        || page.url.searchParams.get('state') === 'letsgo'
    )
    const allowPostJob = $derived(firstJob || (!!$currentUser && $loggedIn));

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

    const validateJob = ():boolean => {
        if (!titleValid) {
            toaster.error({
                title: `Title must be minimum ${minTitleLength} characters!`,
            });
            return false
        }

        if (!descriptionValid) {
            toaster.error({
                title: `Description must be minimum ${minDescriptionLength} characters!`,
            });
            return false;
        }

        return true
    }

    const transformedTag = $derived(
        tagInput.length > 0 ? transFormTag(tagInput) : ''
    );

    const sortedTagOptions = $derived(
        tagOptions.sort((a, b) => {
            if (a.label < b.label) return -1;
            if (a.label > b.label) return 1;
            return 0;
        })
    );

    const filteredTagOptions = $derived(
        tagInput.length > 0
            ? sortedTagOptions.filter(
                (option) => option.value.includes(transformedTag)
            )
            : []
    );
    // Always include the input tag as the first item, even if it's an exact match
    const displayOptions = $derived(
        transformedTag.length > 0
            ? [
                  { label: tagInput, value: transformedTag },
                  ...filteredTagOptions.filter(
                        (option) => option.value !== transformedTag
                    ),
              ]
            : filteredTagOptions
    );

    const tagRecommenderClasses = "w-full flex flex-row gap-[10px] rounded-[6px] " +
        "border-[1px] border-black-100 dark:border-white-100 bg-black-50 flex-wrap " +
        "p-[10px] max-h-[100px] overflow-y-scroll "

    onMount(() => {
        if ($jobToEdit) {
            titleText = $jobToEdit.title;
            descriptionText = $jobToEdit.description;
            $jobToEdit.tTags.forEach((tag: NDKTag) => {
                tagList.push((tag as string[])[1]);
            });
            tagList = tagList;
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
        if (!validateJob()) return;
     
        posting = true;

        await tick();

        try {
            if (firstJob) {
                await finalizeAccount()
            }

            await postJob()

            $onBoarding = false;
            $onBoardingPrivateKey = null
            $onBoardingNsec = ''
            $onBoardingName = ''

            step = 2
        } catch (e) {
            if (e instanceof AccountPublishError) {
                accountPostFailed = true;
            } else if (e instanceof JobPublishError) {
                jobPostFailed = true;
            }
        } finally {
            posting = false
        }

    }

    const finalizeAccount = async () => {
        try {
            $ndk.signer = new NDKPrivateKeySigner($onBoardingNsec);

            $loginMethod = LoginMethod.Local;

            $sessionPK = (
                bytesToHex($onBoardingPrivateKey as Uint8Array<ArrayBufferLike>)
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
            throw new AccountPublishError('Publishing Account Failed')
        }
    }

    async function postJob() {
        try {
            job = new JobEvent($ndk);

            job.title = titleText;
            job.description = descriptionText;
            job.status = JobStatus.New;
            tagList.forEach((tag) => {
                job!.tags.push(['t', tag]);
            });
            // Generate 'd' tag and tags from description hashtags
            // only if we are not editing but creating a new job
            if (!$jobToEdit) {
                job.generateTags();
            } else {
                job.removeTag('d');
                job.tags.push(['d', $jobToEdit.tagValue('d') as string]);
            }

            await job.publish();

            // Navigate to profile page
            $profileTabStore = ProfilePageTabs.Jobs;
        } catch (e) {
            toaster.error({
                title: 'Could not post Job: ' + e,
            });
            throw new JobPublishError('Failed to post Job')
        }
    }

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
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
                        <div class="flex flex-col items-center mt-4 text-xl sm:text-3xl text-center">
                            {#if step === 1}
                                {#if firstJob}
                                    <div class="w-[95vw] sm:w-[60vw] flex gap-x-2 gap-y-2 flex-wrap justify-center mb-2">
                                        <Card>
                                            <div class="text-center text-lg sm:text-xl">
                                                Name:
                                            </div>
                                            <div class="text-center text-lg sm:text-xl">
                                                {$onBoardingName}
                                            </div>
                                        </Card>
                                    </div>
                                {/if}
                                <span>
                                    Great, let's see what You want to get solved:
                                </span>
                            {/if}
                        </div>
                    {:else}
                        <h2 class="text-[40px] font-[500] text-center">
                            {$jobToEdit ? 'Edit' : 'New'} Job Post
                        </h2>
                    {/if}
                </div>
                {#if step === 1}
                    <Card classes="gap-[15px] w-[95vw] sm:w-[60vw]">
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
                                    <div
                                        class={[tagRecommenderClasses, tagInput ? '' : 'hidden']}
                                    >
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
                                    Congratulations, your Job is live on the <strong>free market</strong>!
                                </div>
                                <div class="text-wrap {!firstJob ? 'hidden': ''}">
                                    You took the first step to become Unstoppable. Time to let people know.
                                </div>
                                <div class="w-full flex flex-wrap justify-between gap-y-2">
                                    <div class="flex gap-x-1 items-center">
                                        <Button
                                            onClick={() => showShareModal = true}>
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
                                            buttonText={"Copy Link"}
                                            text={`https://satshoot.com/${job!.encode()}`}
                                            feedbackMessage={"Link Copied!"}>
                                        </CopyButton>
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
                            classes="text-lg sm:text-xl mt-4"
                            onClick={() => goto(
                                new URL(`/${job!.encode()}`, window.location.origin)
                            )}>
                            View Job
                        </Button>
                    </div>
                {/if}
                <div class="w-full flex flex-row justify-center mt-[10px]">
                    {#if !allowPostJob}
                        <Button onClick={handleLogin}>Log in To Post</Button>
                    {:else}
                        <div class="w-full sm:max-w-[60vw] flex gap-x-4 justify-between">
                            {#if firstJob && step === 1}
                                <Button
                                    grow
                                    variant="outlined"
                                    onClick={()=>{
                                        goto(new URL('/letsgo', window.location.origin))
                                    }}>
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
                                        <span>Post on the Free Market</span>
                                    {/if}
                                </Button>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<LoginModal bind:isOpen={showLoginModal} />

<ShareEventModal
    firstTimerMessageTitle={ !firstJob ? '' :
        "I've just published a Job on the free market.\n" 
    } 
    bind:isOpen={showShareModal}
    eventObj={job!} 
/>
