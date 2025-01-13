<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import currentUser, { loggingIn, loginAlert } from '$lib/stores/user';

    import type { NDKTag } from '@nostr-dev-kit/ndk';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';

    import { ticketToEdit } from '$lib/stores/ticket-to-edit';

    import tabStore from '$lib/stores/tab-store';

    import { InputChip } from '@skeletonlabs/skeleton';
    import { Autocomplete } from '@skeletonlabs/skeleton';
    import type { AutocompleteOption, filter } from '@skeletonlabs/skeleton';
    import tagOptions from '$lib/utils/tag-options';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';

    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import ShareTicketModal from '$lib/components/Modals/ShareTicketModal.svelte';

    import { onMount, tick } from 'svelte';
    import { beforeNavigate, goto } from '$app/navigation';
    import { navigating, page } from '$app/stores';
    import redirectStore from '$lib/stores/network';

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

    let allowPostTicket: boolean = true;
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

    $: filteredTagOptions =
        tagInput.length > 0
            ? tagOptions.filter((option) => option.value.includes(transformedTag))
            : tagOptions;

    $: if (!$currentUser || $loggingIn) {
        allowPostTicket = false;
    } else {
        allowPostTicket = true;
    }

    // todo: navigate to ticket
    $: if ($navigating) {
        if ($navigating.to?.url.pathname === '/my-tickets') {
            $tabStore = 0;
        }
    }

    onMount(() => {
        if ($ticketToEdit) {
            titleText = $ticketToEdit.title;
            descriptionText = $ticketToEdit.description;
            $ticketToEdit.tTags.forEach((tag: NDKTag) => {
                tagList.push((tag as string[])[1]);
            });
            tagList = tagList;
        }
        checkRelayConnections();
    });

    beforeNavigate(async () => {
        $ticketToEdit = null;
    });

    function addTag(tag: string) {
        if (tagList.length >= maxTags) {
            const t: ToastSettings = {
                message: `Only ${maxTags} tags are allowed!`,
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

    async function postTicket() {
        if (titleValid && descriptionValid) {
            // Post the ticket...
            if ($currentUser) {
                posting = true;
                await tick();

                const ticket = new TicketEvent($ndk);

                ticket.title = titleText;
                ticket.description = descriptionText;
                ticket.status = TicketStatus.New;
                tagList.forEach((tag) => {
                    ticket.tags.push(['t', tag]);
                });
                // Generate 'd' tag and tags from description hashtags
                // only if we are not editing but creating a new ticket
                if (!$ticketToEdit) {
                    ticket.generateTags();
                } else {
                    ticket.removeTag('d');
                    ticket.tags.push(['d', $ticketToEdit.tagValue('d') as string]);
                }

                try {
                    await ticket.publish();

                    posting = false;

                    $ticketToEdit = null;

                    // Ticket posted Modal
                    const modal: ModalSettings = {
                        type: 'alert',
                        // Data
                        title: 'Success!',
                        body: 'Ticket posted successfully!',
                        buttonTextCancel: 'Ok',
                    };
                    modalStore.trigger(modal);

                    let shareTicketResponse = function (r: boolean) {
                        if (r) {
                            const modalComponent: ModalComponent = {
                                ref: ShareTicketModal,
                                props: { ticket: ticket },
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
                        title: 'Share Ticket as Text Note?',
                        body: 'It will show up in your feed on popular clients.',
                        buttonTextCancel: 'No thanks',
                        buttonTextConfirm: 'Of course!',
                        response: shareTicketResponse,
                    };
                    modalStore.trigger(postAsTextModal);

                    $tabStore = 0;
                    goto('/my-tickets');
                } catch (e) {
                    posting = false;
                    console.log(ticket);
                    const t: ToastSettings = {
                        message: 'Could not post ticket: ' + e,
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                }
            } else {
                const t: ToastSettings = {
                    message: 'Log in to post the Ticket!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        } else {
            const t: ToastSettings = {
                message:
                    '<p style="text-align:center;"><strong>Invalid Ticket!</strong></p><br/>Please fill in a <strong>valid Ticket Title</strong> and <strong>Description</strong> before posting!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[15px]">
                <div class="w-full flex flex-col gap-[5px] justify-start">
                    <h2 class="text-[40px] font-[500]">
                        {$ticketToEdit ? 'Edit' : 'New'} Job Post
                    </h2>
                    <p>Start writing up and publish a job you want to receive offers for</p>
                </div>
                <div
                    class="w-full flex flex-col gap-[25px] bg-white rounded-[8px] p-[15px] shadow-[0_0_4px_0_rgb(0,0,0,0.1)]"
                >
                    <div class="flex flex-col gap-[5px]">
                        <label class="m-[0px] text-[14px]" for="tile">
                            Title (min. 10 chars)
                        </label>
                        <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                            <input
                                id="title"
                                type="text"
                                class="{titleState} transition ease duration-[0.3s] w-full bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]"
                                placeholder="Title of your job post"
                                bind:value={titleText}
                            />
                        </div>
                    </div>
                    <div class="flex flex-col gap-[5px]">
                        <label class="m-[0px] text-[14px]" for="description">
                            Description (min. 20 chars)
                        </label>
                        <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                            <textarea
                                id="description"
                                rows="4"
                                minlength={minDescriptionLength}
                                bind:value={descriptionText}
                                class="{descriptionState} transition ease duration-[0.3s] w-full bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]"
                                placeholder="Detailed description of your job/work/issue"
                            ></textarea>
                        </div>
                    </div>
                    <div class="">
                        <div class="flex flex-col gap-[5px]">
                            <label class="m-[0px] text-[14px]" for="tags">Tags</label>
                            <div
                                class="flex flex-col gap-[10px] rounded-[6px] overflow-hidden bg-white"
                            >
                                <input
                                    type="text"
                                    bind:value={tagInput}
                                    class="transition ease duration-[0.3s] w-full bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]"
                                    placeholder="Search and add a tag, or add a custom tag"
                                />
                                <div
                                    class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-[rgb(0,0,0,0.1)] bg-[rgb(0,0,0,0.05)] flex-wrap p-[10px] max-h-[100px] overflow-y-scroll"
                                >
                                    {#if transformedTag.length > 0 && !filteredTagOptions.some(({ value }) => transformedTag === value)}
                                        <div
                                            class="flex flex-row rounded-[4px] bg-[rgb(0,0,0,0.2)] text-[rgb(0,0,0,0.5)] gap-[10px] overflow-hidden"
                                        >
                                            <span class="pl-[10px] py-[5px]"> {tagInput} </span>
                                            <button
                                                class="transition ease duration-[0.3s] px-[10px] border-l-[1px] border-[rgb(0,0,0,0.1)] hover:bg-[rgb(255,255,255,0.15)]"
                                                on:click={() => addTag(tagInput)}
                                                disabled={tagList.length >= maxTags}
                                            >
                                                <i class="bx bx-plus"> </i>
                                            </button>
                                        </div>
                                    {/if}

                                    {#each filteredTagOptions as { label, value }}
                                        <div
                                            class="flex flex-row rounded-[4px] bg-[rgb(0,0,0,0.2)] text-[rgb(0,0,0,0.5)] gap-[10px] overflow-hidden"
                                        >
                                            <span class="pl-[10px] py-[5px]"> {label} </span>
                                            <button
                                                class="transition ease duration-[0.3s] px-[10px] border-l-[1px] border-[rgb(0,0,0,0.1)] hover:bg-[rgb(255,255,255,0.15)]"
                                                on:click={() => addTag(value)}
                                                disabled={tagList.length >= maxTags}
                                            >
                                                <i class="bx bx-plus"> </i>
                                            </button>
                                        </div>
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
                                    class="w-full flex flex-row gap-[10px] rounded-[6px] border-[1px] border-[rgb(0,0,0,0.1)] bg-[rgb(0,0,0,0.05)] flex-wrap p-[10px]"
                                >
                                    {#each tagList as tag}
                                        <div
                                            class="flex flex-row rounded-[4px] bg-[rgb(59,115,246)] text-white gap-[10px] overflow-hidden"
                                        >
                                            <span class="pl-[10px] py-[5px]">{tag}</span>
                                            <button
                                                class="transition ease duration-[0.3s] text-white px-[10px] border-l-[1px] border-[rgb(255,255,255,0.1)] hover:bg-blue-500"
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
                        class="w-full flex flex-row gap-[10px] justify-center border-t-[1px] border-[rgb(0,0,0,0.1)] pt-[10px] mt-[10px]"
                    >
                        <button
                            class="transition ease duration-[0.3s] py-[5px] px-[10px] w-full max-w-[300px] rounded-[4px] text-center font-[600] cursor-pointer text-white bg-[rgb(59,115,246)] hover:bg-blue-500"
                            on:click={postTicket}
                            disabled={!allowPostTicket || posting}
                        >
                            {#if !allowPostTicket}
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
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
