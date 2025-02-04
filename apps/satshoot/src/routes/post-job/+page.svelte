<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser, { loggingIn } from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';

    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import type { NDKTag } from '@nostr-dev-kit/ndk';

    import { jobToEdit } from '$lib/stores/job-to-edit';

    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';

    import tagOptions from '$lib/utils/tag-options';

    import type { ModalComponent, ModalSettings, ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';

    import ShareTicketModal from '$lib/components/Modals/ShareTicketModal.svelte';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

    import { beforeNavigate, goto } from '$app/navigation';
    import { onMount, tick } from 'svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';

    const toastStore = getToastStore();
    const modalStore = getModalStore();

    let tagInput = '';
    let tagList: string[] = [];

    // For form validation
    const maxTags: number = 5;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    // For form submission
    let titleValid = false;
    let descriptionValid = false;

    // reactive values bound to user input
    let titleText: string = '';
    let descriptionText: string = '';
    // reactive classes based on validity of user input
    let titleState = '';
    let descriptionState = '';

    let allowPostJob: boolean = true;
    let posting = false;

    // Checking Title and description values on user input
    $: {
        if (titleText.length < minTitleLength) {
            titleValid = false;
            titleState = 'input-error';
        } else {
            titleValid = true;
            titleState = 'input-success';
        }

        if (descriptionText.length < minDescriptionLength) {
            descriptionValid = false;
            descriptionState = 'input-error';
        } else {
            descriptionValid = true;
            descriptionState = 'input-success';
        }
    }

    $: transformedTag = tagInput.length > 0 ? transFormTag(tagInput) : '';

    $: sortedTagOptions = tagOptions.sort((a, b) => {
        if (a.label < b.label) return -1;
        if (a.label > b.label) return 1;
        return 0;
    });

    $: filteredTagOptions =
        tagInput.length > 0
            ? sortedTagOptions.filter((option) => option.value.includes(transformedTag))
            : [];

    $: if (!$currentUser || $loggingIn) {
        allowPostJob = false;
    } else {
        allowPostJob = true;
    }

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
            const t: ToastSettings = {
                message: `Cannot add more than ${maxTags} tags!`,
                timeout: 4000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

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
            /^[a-z0-9_]+$/i.test(tagValue) &&
            tagList.length <= maxTags &&
            occurrence === 0;

        if (!valid) {
            const t: ToastSettings = {
                message: 'Invalid tag! Only letters and numbers, NO duplicates!',
                timeout: 4000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
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

                    // Ticket posted Modal
                    const modal: ModalSettings = {
                        type: 'alert',
                        // Data
                        title: 'Success!',
                        body: 'Job posted successfully!',
                        buttonTextCancel: 'Ok',
                    };
                    modalStore.trigger(modal);

                    let shareJobResponse = function (r: boolean) {
                        if (r) {
                            const modalComponent: ModalComponent = {
                                ref: ShareTicketModal,
                                props: { ticket: job },
                            };

                            const shareModal: ModalSettings = {
                                type: 'component',
                                component: modalComponent,
                            };
                            modalStore.trigger(shareModal);
                        }
                    };
                    const postAsTextModal: ModalSettings = {
                        type: 'confirm',
                        title: 'Share Job as Text Note?',
                        body: 'It will show up in your feed on popular clients.',
                        buttonTextCancel: 'No thanks',
                        buttonTextConfirm: 'Of course!',
                        response: shareJobResponse,
                    };
                    modalStore.trigger(postAsTextModal);

                    $profileTabStore = ProfilePageTabs.Jobs;
                    goto('/' + $currentUser.npub + '/');
                } catch (e) {
                    posting = false;
                    console.log(job);
                    const t: ToastSettings = {
                        message: 'Could not post Job: ' + e,
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                }
            } else {
                const t: ToastSettings = {
                    message: 'Log in to post the Job!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        } else {
            const t: ToastSettings = {
                message:
                    '<p style="text-align:center;"><strong>Invalid Job!</strong></p><br/>Please fill in a <strong>valid Job Title</strong> and <strong>Description</strong> before posting!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
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
                                class="flex flex-col gap-[10px] rounded-[6px] overflow-hidden bg-white"
                            >
                                <Input
                                    bind:value={tagInput}
                                    placeholder="Search and add a tag, or add a custom tag"
                                    onKeyPress={handleEnterKeyOnTagInput}
                                    fullWidth
                                />
                                <div
                                    class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-black-100 bg-black-50 flex-wrap p-[10px] max-h-[100px] overflow-y-scroll"
                                >
                                    {#if transformedTag.length > 0 && !filteredTagOptions.some(({ value }) => transformedTag === value)}
                                        <Button
                                            classes="bg-black-200 text-black-500 p-[5px] font-400"
                                            on:click={() => addTag(tagInput)}
                                        >
                                            <span class="pl-[10px]"> {tagInput} </span>
                                            <span
                                                class="flex flex-col items-center justify-center px-[10px] border-l-[1px] border-black-100"
                                            >
                                                <i class="bx bx-plus" />
                                            </span>
                                        </Button>
                                    {/if}

                                    {#each filteredTagOptions as { label, value }}
                                        <Button
                                            classes="bg-black-200 text-black-500 p-[5px] font-400"
                                            on:click={() => addTag(value)}
                                        >
                                            <span class="pl-[10px]"> {label} </span>
                                            <span
                                                class="flex flex-col items-center justify-center px-[10px] border-l-[1px] border-black-100"
                                            >
                                                <i class="bx bx-plus" />
                                            </span>
                                        </Button>
                                    {/each}
                                </div>
                            </div>
                            <label class="m-[0px] text-[14px]" for="added-tags">
                                Added tags ({tagList.length}/{maxTags} max.)
                            </label>
                            <div
                                class="flex flex-col gap-[10px] rounded-[6px] overflow-hidden bg-white"
                            >
                                <div
                                    class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-black-100 bg-black-50 flex-wrap p-[10px]"
                                >
                                    {#each tagList as tag}
                                        <div
                                            class="flex flex-row rounded-[4px] bg-blue-500 text-white gap-[10px] overflow-hidden"
                                        >
                                            <span class="pl-[10px] py-[5px]">{tag}</span>
                                            <button
                                                class="transition ease duration-[0.3s] text-white px-[10px] border-l-[1px] border-white-100 hover:bg-blue-500"
                                                on:click={() => removeTag(tag)}
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
                        class="w-full flex flex-row gap-[10px] justify-center border-t-[1px] border-black-100 pt-[10px] mt-[10px]"
                    >
                        <Button on:click={postJob} disabled={!allowPostJob || posting}>
                            {#if !allowPostJob}
                                Log in To Post
                            {:else if posting}
                                <span>
                                    <ProgressRadial
                                        value={undefined}
                                        stroke={60}
                                        meter="stroke-primary-500"
                                        track="stroke-primary-500/3"
                                        width="w-8"
                                        strokeLinecap="round"
                                    />
                                </span>
                            {:else}
                                <span>Publish Job Post</span>
                            {/if}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    </div>
</div>
