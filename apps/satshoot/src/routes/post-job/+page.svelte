<script lang="ts">
    import ndk from '$lib/stores/session';
    import currentUser, { loggedIn, loggingIn } from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';

    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import type { NDKTag } from '@nostr-dev-kit/ndk';

    import { jobToEdit } from '$lib/stores/job-to-edit';

    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';

    import tagOptions from '$lib/utils/tag-options';

    import { beforeNavigate, goto } from '$app/navigation';
    import { onMount, tick } from 'svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import JobPostSuccess from '$lib/components/Modals/JobPostSuccess.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    let showLoginModal = $state(false);
    let showJobPostSuccessModal = $state(false);
    let postedJob = $state<TicketEvent | null>(null);

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

    const allowPostJob = $derived(!!$currentUser && $loggedIn);

    const { titleValid, titleState } = $derived.by(() => {
        if (titleText.length < minTitleLength) {
            return {
                titleValid: false,
                titleState: 'text-error-500',
            };
        }

        return {
            titleValid: true,
            titleState: 'text-success-500',
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
            descriptionState: 'text-success-500',
        };
    });

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

    async function postJob() {
        if (titleValid && descriptionValid) {
            // Post the Job...
            if ($currentUser) {
                posting = true;
                await tick();

                const job = new TicketEvent($ndk);

                job.title = titleText;
                job.description = descriptionText;
                job.status = TicketStatus.New;
                tagList.forEach((tag) => {
                    job.tags.push(['t', tag]);
                });
                // Generate 'd' tag and tags from description hashtags
                // only if we are not editing but creating a new job
                if (!$jobToEdit) {
                    job.generateTags();
                } else {
                    job.removeTag('d');
                    job.tags.push(['d', $jobToEdit.tagValue('d') as string]);
                }

                try {
                    await job.publish();

                    posting = false;

                    $jobToEdit = null;

                    postedJob = job;
                    showJobPostSuccessModal = true;

                    $profileTabStore = ProfilePageTabs.Jobs;
                    goto('/' + $currentUser.npub + '/');
                } catch (e) {
                    posting = false;
                    console.log(job);
                    toaster.error({
                        title: 'Could not post Job: ' + e,
                    });
                }
            } else {
                toaster.error({
                    title: 'Log in to post the Job!',
                });
            }
        } else {
            toaster.error({
                title: '<p style="text-align:center;"><strong>Invalid Job!</strong></p><br/>Please fill in a <strong>valid Job Title</strong> and <strong>Description</strong> before posting!',
            });
        }
    }

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
    }
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-[10px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="w-full flex flex-col gap-[5px] justify-start">
                    <h2 class="text-[40px] font-[500]">
                        {$jobToEdit ? 'Edit' : 'New'} Job Post
                    </h2>
                </div>
                <Card classes="gap-[15px]">
                    <div class="flex flex-col gap-[5px]">
                        <label class="m-[0px] text-[14px]" for="tile">
                            Title (min. 10 chars)
                        </label>
                        <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                            <Input
                                id="title"
                                bind:value={titleText}
                                placeholder="Title of your job post"
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
                            <label class="m-[0px] text-[14px]" for="tags">Tags</label>
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
                                    class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-black-100 dark:border-white-100 bg-black-50 flex-wrap p-[10px] max-h-[100px] overflow-y-scroll"
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
                            <label class="m-[0px] text-[14px]" for="added-tags">
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
                    <div
                        class="w-full flex flex-row gap-[10px] justify-center border-t-[1px] border-black-100 dark:border-white-100 pt-[10px] mt-[10px]"
                    >
                        {#if !allowPostJob}
                            <Button onClick={handleLogin}>Log in To Post</Button>
                        {:else}
                            <Button onClick={postJob} disabled={posting}>
                                {#if posting}
                                    <ProgressRing color="white" />
                                {:else}
                                    <span>Publish Job Post</span>
                                {/if}
                            </Button>
                        {/if}
                    </div>
                </Card>
            </div>
        </div>
    </div>
</div>

<LoginModal bind:isOpen={showLoginModal} />

{#if postedJob}
    <JobPostSuccess bind:isOpen={showJobPostSuccessModal} job={postedJob} />
{/if}
