<script lang="ts">
    import { beforeNavigate, goto } from '$app/navigation';
    import AddImagesModal from '$lib/components/Modals/AddImagesModal.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
    import { Pricing } from '$lib/events/types';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import { servicePostSuccessState } from '$lib/stores/modals';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import ndk from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { uploadToBlossom } from '$lib/utils/blossom';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { insertThousandSeparator, NostrBuildBlossomServer } from '$lib/utils/misc';
    import tagOptions from '$lib/utils/tag-options';
    import { set } from 'date-fns';
    import { onMount } from 'svelte';

    // For form validation
    const maxTags: number = 5;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    let tagInput = $state('');
    let tagList = $state<string[]>([]);

    let titleText = $state('');
    let descriptionText = $state('');
    let images = $state<File[]>([]);

    let pricingMethod = $state(Pricing.Absolute);
    let amount = $state(0);
    let pledgeSplit = $state(0);
    let imageUrls = $state<string[]>([]);

    let pledgedShare = $derived(Math.floor(amount * (pledgeSplit / 100)));
    let freelancerShare = $derived(amount - pledgedShare);

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
        if (descriptionText.length < minDescriptionLength) {
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

    let posting = $state(false);
    let progressStatus = $state('');

    let showAddImagesModal = $state(false);
    let showLoginModal = $state(false);
    const allowPostService = $derived(!!$currentUser && $loggedIn);

    onMount(() => {
        if ($serviceToEdit) {
            titleText = $serviceToEdit.title;
            descriptionText = $serviceToEdit.description;
            $serviceToEdit.tTags.forEach((tag) => {
                tagList.push((tag as string[])[1]);
            });
            tagList = tagList;
            pricingMethod = $serviceToEdit.pricing;
            amount = $serviceToEdit.amount;
            pledgeSplit = $serviceToEdit.pledgeSplit;
            imageUrls = $serviceToEdit.images;
        }

        checkRelayConnections();
    });

    beforeNavigate(async () => {
        $serviceToEdit = null;
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

    function validate() {
        if (!$currentUser) {
            toaster.error({
                title: 'Log in to post the Service!',
            });

            return false;
        }

        if (!titleValid) {
            toaster.error({
                title: `Title should be at least ${minTitleLength} character long!`,
            });
            return false;
        }

        if (!descriptionValid) {
            toaster.error({
                title: `Description should be at least ${minDescriptionLength} character long!`,
            });
            return false;
        }

        if (amount <= 0) {
            toaster.error({
                title: `Price should be greater than 0`,
            });
            return false;
        }

        if (pledgeSplit < 0) {
            toaster.error({
                title: `Pledge split can't be less than 0`,
            });
            return false;
        }

        if (pledgeSplit > 100) {
            toaster.error({
                title: `Pledge split can't be more than 100%`,
            });
            return false;
        }

        return true;
    }

    async function postService() {
        if (!validate()) return;

        try {
            posting = true;

            const service = new ServiceEvent($ndk);

            // if editing service, add all the tags to new instance
            if ($serviceToEdit) {
                service.tags = $serviceToEdit.tags;
            } else {
                service.status = ServiceStatus.Active;
            }

            service.title = titleText;
            service.description = descriptionText;
            service.pricing = pricingMethod;
            service.amount = amount;

            service.removeTag('t'); // if we don't remove existing 't' tags, it will cause duplication
            tagList.forEach((tag) => {
                service.tags.push(['t', tag]);
            });

            service.setPledgeSplit(pledgeSplit, $currentUser!.pubkey);

            const totalImages = images.length;
            let uploadedImages = 0;

            for (const image of images) {
                progressStatus = `Uploading image ${uploadedImages + 1}/${totalImages}`;

                try {
                    const imageUrl = await uploadToBlossom(image, NostrBuildBlossomServer);
                    imageUrls.push(imageUrl);
                } catch (error) {
                    console.error(error);
                    toaster.error({
                        title: `Failed to upload ${image.name}`,
                    });
                }

                uploadedImages++;
            }

            service.images = imageUrls;

            // if new service is being created, it will not have a 'd' tag
            if (!service.hasTag('d')) {
                service.generateTags();
            }

            progressStatus = 'Publishing';

            await service.publish();

            posting = false;

            $serviceToEdit = null;

            servicePostSuccessState.set({
                showModal: true,
                serviceData: service,
            });

            goto('/' + service.encode() + '/');
        } catch (e) {
            posting = false;
            console.error(e);
            toaster.error({
                title: 'Could not post Job: ' + e,
            });
        }
    }

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
    }

    const selectInputClasses =
        'w-full px-[10px] py-[5px] bg-black-50 focus:bg-black-100 rounded-[6px] ' +
        'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500 focus:outline-[0px]';

    const selectOptionClasses =
        'bg-white dark:bg-brightGray transition-all ease duration-[0.2s] w-[100%] rounded-[4px] px-[8px] py-[4px] hover:bg-blue-500 hover:text-white';
</script>

<div class="w-full flex flex-col gap-0 grow pb-20 sm:pb-5">
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="w-full flex flex-col gap-[5px] justify-start">
                    <h2 class="text-[40px] font-[500]">
                        {$serviceToEdit ? 'Edit' : 'New'} Service
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
                                placeholder="Title of your service"
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
                                placeholder="Detailed description of your service"
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
                    <div class="flex flex-row justify-center">
                        <Button onClick={() => (showAddImagesModal = true)}>
                            {#if images.length}
                                <i class="bx bxs-pencil"></i>
                                <span> Edit Images </span>
                            {:else}
                                <i class="bx bx-plus"></i>
                                <span> Add Images </span>
                            {/if}
                        </Button>
                    </div>
                </Card>
                <Card classes="gap-[15px]">
                    <div class="flex flex-col gap-[5px]">
                        <div class="">
                            <label class="font-[600]" for=""> Pricing method </label>
                        </div>
                        <div class="w-full flex flex-row items-center">
                            <select class={selectInputClasses} bind:value={pricingMethod}>
                                <option value={Pricing.Absolute} class={selectOptionClasses}>
                                    Absolute Price(sats)
                                </option>
                                <option value={Pricing.SatsPerMin} class={selectOptionClasses}>
                                    Time-based Price(sats/minute)
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class="flex flex-col gap-[5px]">
                        <div class="">
                            <label class="font-[600]" for="">
                                Price({pricingMethod ? 'sats/min' : 'sats'})
                            </label>
                        </div>
                        <div class="w-full flex flex-row items-center">
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100_000_000"
                                placeholder="Amount"
                                bind:value={amount}
                                fullWidth
                            />
                        </div>
                    </div>
                    <div class="flex flex-col gap-[5px]">
                        <div class="">
                            <label class="font-[600]" for=""> Pledge split </label>
                        </div>
                        <div class="w-full flex flex-row items-center relative">
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                placeholder="Percentage"
                                bind:value={pledgeSplit}
                                fullWidth
                            />
                            <span
                                class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                            >
                                %
                            </span>
                        </div>
                    </div>
                    <div
                        class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-black-200"
                    >
                        <div class="grow-1">
                            <p class="font-[500]">
                                You'd get:
                                <span class="font-[400]">
                                    {insertThousandSeparator(freelancerShare) +
                                        (pricingMethod ? 'sats/min' : 'sats')}
                                </span>
                            </p>
                        </div>
                        <div class="grow-1">
                            <p class="font-[500]">
                                Your pledge:
                                <span class="font-[400]">
                                    {insertThousandSeparator(pledgedShare) +
                                        (pricingMethod ? 'sats/min' : 'sats')}
                                </span>
                            </p>
                        </div>
                    </div>
                </Card>
                <div class="flex flex-row justify-center mt-[10px]">
                    {#if !allowPostService}
                        <Button onClick={handleLogin}>Log in To Post</Button>
                    {:else}
                        <Button onClick={postService} disabled={posting}>
                            {#if posting}
                                <span>{progressStatus}</span>
                                <ProgressRing color="white" />
                            {:else}
                                <span>Publish Service</span>
                            {/if}
                        </Button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<LoginModal bind:isOpen={showLoginModal} />

{#if showAddImagesModal}
    <AddImagesModal
        bind:isOpen={showAddImagesModal}
        bind:images
        bind:existingImageUrls={imageUrls}
    />
{/if}
