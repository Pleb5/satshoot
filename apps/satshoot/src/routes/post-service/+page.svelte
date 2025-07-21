<script lang="ts">
    import { beforeNavigate, goto } from '$app/navigation';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import AddImagesModal from '$lib/components/Modals/AddImagesModal.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import UserProfile from '$lib/components/UI/Display/UserProfile.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
    import { Pricing, type ZapSplit } from '$lib/events/types';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import { servicePostSuccessState } from '$lib/stores/modals';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import ndk from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { uploadToBlossom } from '$lib/utils/blossom';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import {
        fetchBTCUSDPrice,
        insertThousandSeparator,
        NostrBuildBlossomServer,
        PablosNpub,
    } from '$lib/utils/misc';
    import tagOptions from '$lib/utils/tag-options';
    import { set } from 'date-fns';
    import { nip19 } from 'nostr-tools';
    import { onMount } from 'svelte';

    // For form validation
    const maxTags: number = 8;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    let step = $state(1);

    let initialized = $state(false);
    let tagInput = $state('');
    let tagList = $state<string[]>([]);

    const tagRecommenderClasses = "w-full flex flex-row gap-[10px] rounded-[6px]" +
        "border-[1px] border-black-100 dark:border-white-100 bg-black-50 " +
        "flex-wrap p-[10px] max-h-[100px] overflow-y-scroll "

    let titleText = $state('');
    let descriptionText = $state('');
    let images = $state<File[]>([]);

    let pricingMethod = $state(Pricing.Absolute);
    let amount = $state(0);
    let BTCUSDPrice = -1;
    // USD price with decimals cut off and thousand separators
    let usdPrice = $derived(Math.floor((amount / 100_000_000) * BTCUSDPrice));
    let pledgeSplit = $state(0);
    let sponsoredNpub = $state(PablosNpub);
    let sponsoredPubkey = $state(nip19.decode(PablosNpub).data);
    let sponsoringSplit = $state(50);
    let validSponsoredNpub = $derived(/^^(npub1)[a-zA-Z0-9]*/.test(sponsoredNpub));

    let imageUrls = $state<string[]>([]);

    let pledgedShare = $derived(Math.floor(amount * (pledgeSplit / 100)));
    let freelancerShare = $derived(amount - pledgedShare);

    let sponsoredShare = $derived(
        validSponsoredNpub ? Math.floor(pledgedShare * (sponsoringSplit / 100)) : 0
    );
    let satshootShare = $derived(pledgedShare - sponsoredShare);

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
        if (descriptionText.length < minDescriptionLength) {
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
        fetchBTCUSDPrice().then((price) => (BTCUSDPrice = price));

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
            sponsoredNpub = serviceToEdit ? $serviceToEdit.sponsoredNpub : PablosNpub;
            sponsoredPubkey = nip19.decode(sponsoredNpub).data as string;
            sponsoringSplit = $serviceToEdit?.sponsoringSplit ? $serviceToEdit.sponsoringSplit : 50;
            imageUrls = $serviceToEdit.images;
        }

        checkRelayConnections();
        initialized = true;
    });

    $effect(() => {
        if (initialized) {
            const error = validateSponsoredNpub(sponsoredNpub);
            if (error) {
                toaster.error({title: error});
                return;
            }
            if (sponsoredNpub) {
                try {
                    const decodeResult = nip19.decode(sponsoredNpub);
                    switch (decodeResult.type) {
                        case 'npub':
                            sponsoredPubkey = decodeResult.data;
                            break;
                        default:
                            sponsoredPubkey = '';
                            toaster.error({
                                title: 'Expecting an npub but got a different nip-19 entity.',
                            });
                    }
                } catch (error) {
                    sponsoredPubkey = '';
                    toaster.error({ title: 'Invalid npub.' });
                }
            } else {
                sponsoredPubkey = '';
            }
        }
    });

    function buildSponsoredZapSplit(npub: string, percentage: number): ZapSplit {
        const decodedData = nip19.decode(npub);
        let sponsoredPubkey = '';
        if (decodedData.type === 'npub') {
            sponsoredPubkey = decodedData.data;
        } else {
            const errorMessage = 'Error happened while decoding sponsored npub:' + sponsoredNpub;
            throw Error(errorMessage);
        }
        return { pubkey: sponsoredPubkey, percentage: percentage };
    }

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

    function invalid(): string {
        if (!$currentUser) {
            return 'Log in to post the Service!';
        }

        if (!titleValid) {
            return `Title should be at least ${minTitleLength} character long!`;
        }

        if (!descriptionValid) {
            return `Description should be at least ${minDescriptionLength} character long!`;
        }

        if (amount <= 0) {
            return `Price should be greater than 0`;
        }

        if (pledgeSplit < 0) {
            return `Pledge split can't be less than 0`;
        }

        if (pledgeSplit > 100) {
            return `Pledge split can't be more than 100%`;
        }

        return validateSponsoredNpub(sponsoredNpub);
    }

    function validateSponsoredNpub(npub: string): string {
        if (npub) {
            if (!validSponsoredNpub) {
                return 'Invalid npub!';
            } else if (sponsoringSplit < 0) {
                return 'Sponsoring split below 0!';
            } else if (sponsoringSplit > 100) {
                return 'Sponsoring split above 100% !';
            }
        }

        return '';
    }

    async function postService() {
        const error = invalid();
        if (error) {
            toaster.error({title: error});
            return;
        }

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

            const sponsoredZapSplit =
                sponsoredNpub && pledgeSplit
                    ? buildSponsoredZapSplit(sponsoredNpub, sponsoringSplit)
                    : undefined;
            service.setZapSplits(pledgeSplit, $currentUser!.pubkey, sponsoredZapSplit);

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

    let pledgeTooltip =
        '<div>' +
            '<div class="font-bold">Pledge Your support for SatShoot development!❤️‍🔥 ⚡</div>' +
        '<ul class="list-inside list-disc space-y-2">' +
            '<li>The Pledge Percentage will be paid to SatShoot by the Client</li>' +
            '<li>' +
                'Pledges appear on Services' +
            '</li>' +
            '<li>' +
                'Overall pledge amount is displayed ' +
                'on Profiles' +

            '</li>' +
            '<li>' +
                'This can boost Reputation of a Freelancer' +
            '</li>' +
        '</ul>' +
        '</div>';

    const selectInputClasses =
        'w-full px-[10px] py-[5px] bg-black-50 focus:bg-black-100 rounded-[6px] text-lg sm:text-xl' +
        'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500 focus:outline-[0px]';

    const selectOptionClasses =
        'bg-white dark:bg-brightGray transition-all ease duration-[0.2s] w-[100%] text-lg sm:text-xl' +
        ' rounded-[4px] px-[8px] py-[4px] hover:bg-blue-500 hover:text-white';
</script>
<div class="w-full flex flex-col gap-0 grow pb-20 sm:pb-5">
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="w-full flex flex-col gap-[5px] justify-start">
                    <h2 class="text-xl sm:text-[40px] font-[500] text-center">
                        {$serviceToEdit ? 'Edit' : 'New'} Service
                    </h2>
                </div>
                {#if step === 1}
                    <Card classes="gap-[15px]">
                        <div class="flex flex-col gap-[5px]">
                            <label class="m-[0px] text-lg sm:text-xl" for="tile">
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
                            <label class="m-[0px] text-lg sm:text-xl" for="description">
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
                            <div class="">
                                <div class="flex flex-col gap-[5px]">
                                    <label class="m-[0px] text-lg sm:text-xl" for="tags">Tags</label>
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
                        </div>
                    </Card>
                {:else if step === 2}
                    <Card>
                        <div class="flex justify-center">
                            <Button classes={"w-full sm:w-[50%]"} onClick={() => (showAddImagesModal = true)}>
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
                                <label class="font-[600] text-lg sm:text-xl" for=""> Pricing method </label>
                            </div>
                            <div class="w-full flex flex-row items-center">
                                <select class={selectInputClasses} bind:value={pricingMethod}>
                                    <option value={Pricing.Absolute} class={selectOptionClasses}>
                                        Product price(sats)
                                    </option>
                                    <option value={Pricing.Hourly} class={selectOptionClasses}>
                                        Service fee(sats/hour)
                                    </option>
                                </select>
                            </div>
                        </div>
                        <div class="flex flex-col gap-[5px]">
                            <div class="">
                                <label class="font-[600] text-lg sm:text-xl" for="">
                                    Price({pricingMethod ? 'sats/hour' : 'sats'})
                                </label>
                            </div>
                            <div class="w-full flex flex-row items-center relative">
                                <Input
                                    classes={ "text-lg sm:text-xl"}
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100_000_000"
                                    placeholder="Amount"
                                    bind:value={amount}
                                    fullWidth
                                />
                                <span
                                    class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                                >
                                    {usdPrice < 0
                                        ? '?'
                                        : '$' +
                                          usdPrice
                                              .toString()
                                              .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
                                          ' USD'}
                                </span>
                            </div>
                        </div>
                        <div class="flex flex-col gap-[5px]">
                            <div class="">
                                <label class="font-[600] text-lg sm:text-xl" for=""> Pledge split </label>

                                <QuestionIcon
                                    extraClasses="text-[14px] p-[3px]"
                                    placement="bottom-start"
                                    popUpText={pledgeTooltip}
                                />
                            </div>
                            <div class="w-full flex flex-row items-center relative">
                                <Input
                                    classes={ "text-lg sm:text-xl"}
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
                            <div class="flex flex-col gap-[5px] grow-1">
                                <div class="">
                                    <label class="font-[600]" for=""> Sponsored npub </label>
                                </div>
                                {#if sponsoredPubkey}
                                    <UserProfile pubkey={sponsoredPubkey} />
                                {/if}
                                <div class="w-full flex flex-row items-center relative">
                                    <Input
                                        type="text"
                                        placeholder="npub to sponsored"
                                        bind:value={sponsoredNpub}
                                        fullWidth
                                    />
                                </div>
                            </div>
                            <div class="flex flex-col gap-[5px]">
                                <div class="">
                                    <label class="font-[600]" for=""> Sponsoring split </label>
                                </div>
                                <div class="w-full flex flex-row items-center relative">
                                    <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        placeholder="Percentage"
                                        bind:value={sponsoringSplit}
                                        disabled={!validSponsoredNpub}
                                        fullWidth
                                    />
                                    <span
                                        class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                                    >
                                        %
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div
                            class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-black-200"
                        >
                            <div class="grow-1">
                                <p class="font-[500] text-lg sm:text-xl">
                                    You'd get:
                                    <span class="font-[400] text-lg sm:text-xl">
                                        {insertThousandSeparator(freelancerShare) +
                                            (pricingMethod ? ' sats/hour' : ' sats')}
                                    </span>
                                </p>
                            </div>
                            <div class="grow-1">
                                <p class="font-[500] text-lg sm:text-xl">
                                    Your pledge:
                                    <span class="font-[400] text-lg sm:text-xl">
                                        {insertThousandSeparator(pledgedShare) +
                                            (pricingMethod ? ' sats/hour' : ' sats')}
                                    </span>
                                </p>
                            </div>

                            <div class="grow-1">
                                <p class="font-[500]">
                                    Satshoot'd get:
                                    <span class="font-[400]">
                                        {insertThousandSeparator(satshootShare) +
                                            (pricingMethod ? ' sats/min' : ' sats')}
                                    </span>
                                </p>
                            </div>
                            <div class="grow-1">
                                <p class="font-[500]">
                                    Sponsored npub'd get:
                                    <span class="font-[400]">
                                        {insertThousandSeparator(sponsoredShare) +
                                            (pricingMethod ? ' sats/min' : ' sats')}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </Card>
                {/if}
                <div class="flex flex-row justify-center mt-[10px]">
                    {#if !allowPostService}
                        <Button onClick={handleLogin}>Log in To Post</Button>
                    {:else if step === 1}
                        <Button grow classes={"sm:max-w-80"} onClick={()=>step=2}>Next</Button>
                    {:else if step === 2}
                        <div class="w-full grid grid-cols-[20%_50%] gap-x-4 justify-between">
                            <Button
                                variant="outlined"
                                onClick={()=>step=1}>
                                Back
                            </Button>
                            <Button
                                onClick={postService}
                                disabled={posting}
                                classes={'bg-yellow-500'}
                            >
                                {#if posting}
                                    <span>{progressStatus}</span>
                                    <ProgressRing color="white" />
                                {:else}
                                    <span>Publish Service</span>
                                {/if}
                            </Button>
                        </div>
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
