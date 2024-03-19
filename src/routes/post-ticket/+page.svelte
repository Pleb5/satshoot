<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import type { NDKTag } from '@nostr-dev-kit/ndk';
    import { NDKRelaySet } from '@nostr-dev-kit/ndk';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';

    import { ticketToEdit } from "$lib/stores/ticket-to-edit";

    import { InputChip } from '@skeletonlabs/skeleton';
    import { Autocomplete } from '@skeletonlabs/skeleton';
    import type { AutocompleteOption } from '@skeletonlabs/skeleton';
    import tagOptions from "$lib/utils/tag-options";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import ShareTicketModal from "$lib/components/Modals/ShareTicketModal.svelte";
    import { onMount } from 'svelte';
    import { beforeNavigate, goto } from '$app/navigation';

    // Retrieve Toast store at the top level
    const toastStore = getToastStore();

    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();
			
    let tagInput = '';
    

    let tagList: string[] = [];

    // For form validation
    const maxTags:number = 5;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    // For form submission
    let titleValid = false;
    let descriptionValid = false;
    // reactive values bound to user input
    let titleText: string='';
    let descriptionText: string='';
    // reactive classes based on validity of user input
    let titleState = '';
    let descriptionState = '';

    // Tag validation on tag selection from autocomplete
    function onTagSelection(event: CustomEvent<AutocompleteOption<string>>): void {
        let tagValue = event.detail.value;
        // Run validation checks here(dont allow duplicates, max=5 tags) 
        // and modify underlying data structure
        // Cannot explicitly call submit of InputChips component without nasty workarounds
        // Modify conditions if validity checks ever change
        if (tagList.length < maxTags && tagList.includes(tagValue) === false) {
            tagList = [...tagList, tagValue];
            tagInput = '';        
        }
    }

    // Checking Title and description values on user input
    $: {
        if (titleText.length < minTitleLength) {
            titleValid = false;
            titleState = 'input-error';
        }
        else {
            titleValid = true;
            titleState = 'input-success';
        }

        if (descriptionText.length < minDescriptionLength) {
            descriptionValid = false;
            descriptionState = 'input-error';
        }
        else {
            descriptionValid = true;
            descriptionState = 'input-success';
        }
    }

    async function postTicket() {
       if (titleValid && descriptionValid) {
            // Post the ticket...
            if ($ndk.activeUser) {
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
                await ticket.publish(
                    new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)
                );

                $ticketToEdit = null;

                // Ticket posted Modal
                const modal: ModalSettings = {
                    type: 'alert',
                    // Data
                    title: 'Success!',
                    body: 'Ticket posted successfully!',
                    buttonTextCancel:'Ok',
                };
                modalStore.trigger(modal);

                let shareTicketResponse = function(r: boolean){
                    if (r) {
                        const modalComponent: ModalComponent = {
                            ref: ShareTicketModal,
                            props: {ticket: ticket},
                        };

                        const shareModal: ModalSettings = {
                            type: 'component',
                            component: modalComponent,
                        };
                        modalStore.trigger(shareModal);
                    }
                }
                const postAsTextModal: ModalSettings = {
                    type: 'confirm',
                    title: 'Share Ticket as Text Note?',
                    body: 'It will show up in your feed on popular clients.',
                    buttonTextCancel: 'No thanks',
                    buttonTextConfirm: 'Of course!',
                    response: shareTicketResponse,
                };
                modalStore.trigger(postAsTextModal);


                goto('/my-tickets');
            } else {
                const t: ToastSettings = {
                    message: 'No Active User to post the Ticket!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        } else {
            const t: ToastSettings = {
                message: '<p style="text-align:center;"><strong>Invalid Ticket!</strong></p><br/>Please fill in a <strong>valid Ticket Title</strong> and <strong>Description</strong> before posting!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
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
    });

    beforeNavigate(async ()=>{
        $ticketToEdit = null;
    });
			
</script>

<div class="flex justify-center">
    <div class="p-4">
        <label class="label max-w-md">
            <span class="text-lg sm:text-2xl">Ticket Title(min. 10chars)</span>
            <input 
                class="input {titleState}"
                type="text"
                placeholder="Title of your Ticket"
                minlength={minTitleLength}
                bind:value={titleText}
            />
        </label>


        <label class="label max-w-xl mt-8">
            <span class="text-lg sm:text-2xl">Ticket Description(min. 20chars)</span>
            <textarea 
                class="textarea {descriptionState}"
                rows="4"
                placeholder="Detailed description of your issue"
                minlength={minDescriptionLength}
                bind:value={descriptionText}
            />
        </label>


        <div class="text-token max-w-sm gap-y-2 mt-8">
            <span class="text-lg sm:text-2xl">Ticket Tags(max. 5pcs)</span>
            <InputChip
                bind:input={tagInput}
                bind:value={tagList}
                name="tags"
                placeholder="Enter tag value..."
                max={maxTags}
                minlength={2}
                maxlength={20}
            />

            <div class="card max-w-sm pb-4 overflow-y-auto max-h-32" tabindex="-1">
                <Autocomplete
                    bind:input={tagInput}
                    options={tagOptions}
                    on:selection={onTagSelection}
                />
            </div>
        </div>
    </div>
</div>

<div class="flex justify-center my-8">
    <button type="button"
        class="btn btn-lg bg-gradient-to-br variant-gradient-primary-tertiary"
        on:click={postTicket}
    >
        <span>Post Ticket</span>
    </button>
</div>
