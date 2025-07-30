<script lang="ts">
    import { beforeNavigate, goto } from '$app/navigation';
    import { page } from '$app/state';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import AddImagesModal from '$lib/components/Modals/AddImagesModal.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import ShareEventModal from '$lib/components/Modals/ShareEventModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import CopyButton from '$lib/components/UI/Buttons/CopyButton.svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
    import { Pricing } from '$lib/events/types';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import { servicePostSuccessState } from '$lib/stores/modals';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, {
        loggedIn,
        loginMethod,
        onBoarding,
        onBoardingName,
        onBoardingNsec,
        onBoardingPrivateKey 
    } from '$lib/stores/user';
    import { uploadToBlossom } from '$lib/utils/blossom';
    import {
        broadcastUserProfile,
        checkRelayConnections,
        initializeUser 
    } from '$lib/utils/helpers';
    import {
        fetchBTCUSDPrice,
        insertThousandSeparator, 
        NostrBuildBlossomServer 
    } from '$lib/utils/misc';
    import tagOptions from '$lib/utils/tag-options';
    import { bytesToHex } from '@noble/ciphers/utils';
    import { NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
    import { onMount, tick } from 'svelte';

    class AccountPublishError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'AccountPublishError';
        }
    }

    class ServicePublishError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ServicePublishError';
        }
    }

    let user: NDKUser|null = null;
    let service = $state<ServiceEvent|null>(null);

    // For form validation
    const maxTags: number = 8;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    let step = $state(1)

    let tagInput = $state('');
    let tagList = $state<string[]>([]);

    const tagRecommenderClasses = "w-full flex flex-row gap-[10px] rounded-[6px]" +
        "border-[1px] border-black-100 dark:border-white-100 bg-black-50 " +
        "flex-wrap p-[10px] max-h-[100px] overflow-y-scroll "

    let titleText = $state('');
    let descriptionText = $state('');
    let images = $state<File[]>([]);

    let pricingMethod = $state(Pricing.Hourly);
    let inputAmount = $state<number|null>(null)
    let displayAmount = $state<string>('')
    let amount = $derived(inputAmount || 0);

    let BTCUSDPrice = -1;
    // USD price with decimals cut off and thousand separators
    let usdPrice = $derived(Math.floor(amount / 100_000_000 * BTCUSDPrice))

    let pledgeSplit = $state<number|null>(null);
    let imageUrls = $state<string[]>([]);

    let pledgedShare = $derived(Math.floor(amount * ((pledgeSplit || 0) / 100)));
    let freelancerShare = $derived(amount - pledgedShare);

    let firstService = $derived(page.url.searchParams.get('state') === 'letsgo')
    let accountPostFailed = $state(false);
    let servicePostFailed = $state(false);

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

    function formatNumber(num: number | null): string {
        if (num === null || num === undefined) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function parseNumber(str: string): number | null {
        if (!str || str.trim() === '') return null;
        const parsed = Number(str.replace(/,/g, ''));
        return isNaN(parsed) ? null : parsed;
    }

    function handleAmountInput(event: Event): void {
        const target = event.target as HTMLInputElement;
        const parsedValue = parseNumber(target.value);
        
        if (parsedValue === null) {
            inputAmount = null;
            displayAmount = '';
        } else {
            inputAmount = parsedValue;
            displayAmount = formatNumber(parsedValue);
        }
    }

    $effect(() => {
        displayAmount = formatNumber(inputAmount);
    });


    let posting = $state(false);
    let progressStatus = $state('');

    let showAddImagesModal = $state(false);
    let showShareModal = $state(false);
    let showLoginModal = $state(false);
    const allowPostService = $derived(firstService || (!!$currentUser && $loggedIn));

    onMount(() => {
        fetchBTCUSDPrice().then((price) => BTCUSDPrice = price)

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

    const validateStep1 = ():boolean => {
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

        return true
    }

    const validateStep2 = ():boolean => {
        if (amount <= 0) {
            toaster.error({
                title: `Price should be greater than 0`,
            });
            return false;
        }

        if (!pledgeSplit) {
            toaster.error({
                title: `Please set the Pledge Split!`,
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
        
        return true
    }

    const finalize = async () => {
        if (!validateStep1() || !validateStep2()) return

        try {
            posting = true;
            await tick()

            if (firstService) {
                await finalizeAccount()
            }

            await postService();

            $onBoarding = false;
            $onBoardingPrivateKey = null
            $onBoardingNsec = ''
            $onBoardingName = ''

            step = 4
        } catch (e) {
            if (e instanceof AccountPublishError) {
                accountPostFailed = true;
            } else if (e instanceof ServicePublishError) {
                servicePostFailed = true;
            }
        } finally {
            posting = false;
        }
    }

    const finalizeAccount = async () => {
        try {
            $ndk.signer = new NDKPrivateKeySigner($onBoardingNsec);

            $loginMethod = LoginMethod.Local;

            $sessionPK = (bytesToHex($onBoardingPrivateKey as Uint8Array<ArrayBufferLike>));

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

    async function postService() {
        try {
            if (!user && !$currentUser) throw new Error('Bug! User not set!')
            service = new ServiceEvent($ndk);

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

            // if we don't remove existing 't' tags, it will cause duplication
            service.removeTag('t'); 
            tagList.forEach((tag) => {
                service!.tags.push(['t', tag]);
            });

            service.setPledgeSplit(
                pledgeSplit as number,
                user?.pubkey ?? $currentUser!.pubkey
            );

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

            progressStatus = 'Publishing Service';

            await service.publish();

            servicePostSuccessState.set({
                showModal: true,
                serviceData: service,
            });
        } catch (e) {
            console.error(e);
            toaster.error({
                title: 'Could not Post Service: ' + e,
            });
            throw new ServicePublishError('Publishing Service Failed')
        }
    }

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
    }


    const serviceTitleTooltip =
        '<div>' +
            '<div class="font-bold">' + 
                'Make this short and to the point. Great examples include: Web Development, Business Consulting, etc.' +
            '</div>' +
        '</div>';

    const tagsTooltip =
        '<div>' +
            '<div class="font-bold">' + 
                'Keywords and technologies you are proficient with.' +
            '</div>' +
        '</div>';

    const pledgeTooltip =
        '<div>' +
            '<div class="font-bold">Pledge Your support for SatShoot development!❤️‍🔥 ⚡</div>' +
        '<ul class="list-inside list-disc space-y-2">' +
            '<li>A small piece of your pie will be paid to SatShoot by the Client</li>' +
            '<li>' +
                'Pledges appear on Services' +
            '</li>' +
            '<li>' +
                'Overall pledge amount is displayed on Profiles' +
            '</li>' +
            '<li>' +
                'This can boost Reputation of a Freelancer' +
            '</li>' +
        '</ul>' +
        '</div>';

    const shareServiceTooltip =
        '<div>' +
            '<div class="">' + 
                'When you share on Nostr, SatShoot will re-share your post, so ' +
                'more people will see it.' +
            '</div>' +
        '</div>';

    const copyLinkTooltip =
        '<div>' +
            '<div class="">' + 
                'This is a Nostr link to your service. Be careful where you share ' + 
                'it! While your Nostr profile is not tied to your real name, if you ' +
                'share this on mainstream social media you will for ever link your ' +
                'account to your real identity!' +
            '</div>' +
        '</div>';

    const selectInputClasses =
        'w-full px-[10px] py-[5px] bg-black-50 focus:bg-black-100 rounded-[6px] text-lg sm:text-xl' +
        'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500 focus:outline-[0px]';

    const selectOptionClasses =
        'bg-white dark:bg-brightGray transition-all ease duration-[0.2s] w-[100%] text-lg sm:text-xl' +
        ' rounded-[4px] px-[8px] py-[4px] hover:bg-blue-500 hover:text-white';

    const amountInputClasses = 'transition ease duration-[0.3s] px-[10px] py-[5px] ' +
    'bg-black-50 focus:bg-black-100 outline-[0px] focus:outline-[0px] border-[2px] ' +
    'border-black-100 dark:border-white-100 focus:border-blue-500 rounded-[6px] ' + 
    'w-full text-lg sm:text-xl'

</script>
{#snippet firstForm()}
    <Card classes="gap-[15px]">
        <div class="flex flex-col gap-[5px]">
            <div class="flex gap-x-2 items-center">
                <label class="m-[0px] text-lg sm:text-xl" for="tile">
                    Title (min. 10 chars)
                </label>
                <QuestionIcon
                    extraClasses="text-[14px] p-[3px]"
                    placement="bottom-start"
                    popUpText={serviceTitleTooltip}
                />
            </div>
            <div class="flex flex-row rounded-[6px] overflow-hidden bg-white">
                <Input
                    id="title"
                    bind:value={titleText}
                    placeholder="My service"
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
                    placeholder="Have an idea? Let's work together and I will help you make it a reality!"
                    classes="min-h-[100px] {descriptionState}"
                    fullWidth
                    textarea
                    rows={6}
                    minlength={minDescriptionLength}
                />
            </div>
            <div class="">
                <div class="flex flex-col gap-[5px]">
                    <div class="flex gap-x-2 items-center">
                        <label class="m-[0px] text-lg sm:text-xl" for="tags">Tags</label>
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
                            placeholder="Search, or add a custom tag"
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
{/snippet}

{#snippet secondForm()}
    {#if !firstService}
        <Card>
            <div class="flex justify-center">
                <Button classes={"w-full sm:w-[50%]"} onClick={() => (showAddImagesModal = true)}>
                    {#if images.length}
                        <i class="bx bxs-pencil"></i>
                        <span> Edit Images </span>
                    {:else}
                        <i class="bx bx-plus"></i>
                        <span> Add Images (optional) </span>
                    {/if}
                </Button>
            </div>
        </Card>
    {/if}
    <Card classes="gap-[15px]">
        <div class="flex flex-col gap-[5px]">
            {#if !firstService}
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
            {/if}
        </div>
        <div class="flex flex-col gap-[5px]">
            <div class="">
                <label class="font-[600] text-lg sm:text-xl" for="">
                    Price({pricingMethod ? 'sats/hour' : 'sats'})
                </label>
            </div>
            <div class="w-full flex flex-row items-center relative">
                <input
                    class={amountInputClasses}
                    type="text"
                    placeholder="50,000 sats / hour"
                    value={displayAmount}
                    oninput={handleAmountInput}
                />

                <span
                    class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                >
                    {
                    usdPrice < 0
                        ? '?'
                        : '$' + usdPrice.toString()
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                            + ' USD'
                    } 
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
                    placeholder="1%"
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
        </div>
    </Card>
{/snippet}

<div class="w-full flex flex-col gap-0 grow pb-20 sm:pb-5">
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[10px]">
                <div class="w-full flex flex-col gap-[5px] items-center">
                    {#if firstService}
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
                        <div class="mt-4 text-xl sm:text-3xl text-center">
                            {#if step === 1}
                                <span>
                                    Great, let's see what service you have to offer:
                                </span>
                            {:else if step === 2} 
                                <span>
                                    Fine work deserves <strong>hard money</strong>. What's your hourly rate?
                                </span>
                            {/if}
                        </div>
                    {:else}
                        <h2 class="text-xl sm:text-[40px] font-[500] text-center underline">
                            {$serviceToEdit ? 'Edit' : 'New'} Service
                        </h2>
                    {/if}
                    {#if step === 3}
                        <span class="text-lg sm:text-xl">
                            Here is what we got so far. If it's correct hit Post.
                        </span>
                        <div class="w-[95vw] sm:w-[80vw] flex gap-x-2 gap-y-2 flex-wrap">
                            {#if firstService}
                                <Card>
                                    <div class="text-center text-lg sm:text-xl">
                                        Name:
                                    </div>
                                    <div class="text-center text-lg sm:text-xl">
                                        {$onBoardingName}
                                    </div>
                                </Card>
                            {/if}
                            {@render firstForm()}
                            {@render secondForm()}
                        </div>
                    {/if}
                </div>
                {#if step === 1}
                    {@render firstForm()}
                {:else if step === 2}
                    {@render secondForm()}
                {:else if step === 4}
                    <div class="flex flex-col items-center w-full">
                        <Card classes="w-[95vw] sm:w-[70vw]">
                            <div class="flex flex-col items-center gap-y-2 text-xl sm:text-2xl">
                                <div class="text-wrap">
                                    Congratulations, your service is live on the <strong>free market</strong>!
                                </div>
                                <div class="text-wrap">
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
                                            popUpText={shareServiceTooltip}
                                        />
                                    </div>
                                    <div class="flex gap-x-1 items-center">
                                        <CopyButton 
                                            buttonText={"Copy Link"}
                                            text={`https://satshoot.com/${service!.encode()}`}
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
                                new URL(`/${service!.encode()}`, window.location.origin)
                            )}>
                            View Service
                        </Button>
                    </div>
                {/if}
                <div class="flex flex-row justify-center mt-[10px]">
                    {#if !allowPostService}
                        <Button onClick={handleLogin}>Log in To Post</Button>
                    {:else if step === 1}
                        <div class="w-full grid grid-cols-[20%_50%] gap-x-4 justify-between">
                            <Button
                                variant="outlined"
                                onClick={()=>goto((new URL('/letsgo', window.location.origin)))}>
                                Back
                            </Button>
                            <Button 
                                grow
                                classes={"sm:max-w-80"}
                                onClick={() => {
                                    if (validateStep1()) {
                                        step = 2
                                    }
                                }}>
                                Next
                            </Button>
                        </div>
                    {:else if step === 2}
                        <div class="w-full grid grid-cols-[20%_50%] gap-x-4 justify-between">
                            <Button
                                variant="outlined"
                                onClick={()=>step=1}>
                                Back
                            </Button>
                            <Button
                                onClick={() => {
                                    if (validateStep2()) {
                                        step = 3
                                    }
                                }}>
                                <span>Next</span>
                            </Button>
                        </div>
                    {:else if step === 3}
                        <div class="w-full grid grid-cols-[20%_auto] gap-x-4 justify-between">
                            <Button
                                variant="outlined"
                                onClick={()=>step=2}>
                                Back
                            </Button>
                            <Button
                                onClick={finalize}
                                disabled={posting}
                                classes={"bg-yellow-500"}>
                                {#if posting}
                                    <span>{progressStatus}</span>
                                    <ProgressRing color="white" />
                                {:else if servicePostFailed || accountPostFailed}
                                    <span>Try again</span>
                                {:else}
                                    <span>Post on the Free Market</span>
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


<ShareEventModal 
    firstTimerMessageTitle={ !firstService ? '' :
        "I've just published my service offering on the free market.\n" + 
        "SatShoot helped me take the first step towards becoming Unstoppable! ⚡"
    } 
    bind:isOpen={showShareModal}
    eventObj={service!} 
/>
