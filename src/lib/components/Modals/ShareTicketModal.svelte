<script lang="ts">
	import { onMount, type SvelteComponent, tick } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind, type NDKTag } from '@nostr-dev-kit/ndk';

    import { nip19 } from "nostr-tools";
    import { relaysFromNaddr } from '$lib/utils/nip19';

    
    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import { clipboard } from '@skeletonlabs/skeleton';
	import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { TicketEvent } from '$lib/events/TicketEvent';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

    export let ticket: TicketEvent;
    let shareURL = '';

    let message: string = '';
    let posting = false;

    async function postTicket() {
        posting = true;
        await tick();

        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = message;
        kind1Event.generateTags();

        try {

            let relays = await kind1Event.publish();
            console.log(relays)
            posting = false;
            const t: ToastSettings = {
                message: 'Ticket Posted as Text Note!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        } catch(e) {
            posting = false;
            const t: ToastSettings = {
                message: 'Error happened while publishing note!',
                timeout: 5000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        }
    }

    onMount(()=>{
        if (ticket) {
            // Construct a valid shareURL that has a path below 257 chars, trailing slash included 
            // naddr1... must be less than 256 chars
            // or webserver config will respond with 403 forbidden
            // see https://serverfault.com/questions/140852/rewritten-urls-with-parameter-length-255-dont-work
            const relayURLs = relaysFromNaddr(ticket.encode()).split(',');
            // console.log('full naddr: ', ticket.encode())
            // console.log('ticket on relays', ticket.onRelays)
            // console.log('relays', relayURLs)

            // Add relays one by one until the 256 char limit
            // for the encoded result is not exceeded
            let relaysPermitted: string[] = [];
            let path = '';
            for (const url of relayURLs) {
                relaysPermitted.push(url);
                path = nip19.naddrEncode({
                    kind: ticket.kind as number,
                    pubkey: ticket.pubkey,
                    identifier: ticket.dTag as string,
                    relays: relaysPermitted,
                });
                
                if(path.length < 256) {
                    shareURL = `https://bitcointroubleshoot.com/${path}`;
                } else break;
            }

            // Set default text
            message = `Hey Nostr,\nPlease help me with this #bitcoin issue and I can pay sats for your time:\n\n`;
            message += `${ticket.title}\n\n`;
            message += `${ticket.description}\n\n`;
            message += `Make an offer on this URL:\n\n`;
            message += `${shareURL}\n\n`;
            message += `#bitcointroubleshoot #asknostr`;
            ticket.tTags.forEach((tag: NDKTag)=>{
                message += ` #${(tag as string[])[1]}`;
            });
        }
    });

    let copied = false;
    function onCopyURL(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }

</script>

{#if $modalStore[0]}
    {#if ticket}
        <div class="card p-4 bg-primary-300-600-token">
            <div class="flex justify-center mb-2">
                <button 
                    class="btn btn-md w-40 bg-tertiary-200-700-token font-bold "
                    use:clipboard={shareURL}
                    on:click={onCopyURL}
                >
                    {copied ? 'Copied!' : 'Copy Ticket URL'}
                </button>
            </div>
            <h4 class="h4 text-center mb-2">{'Post Ticket as Text Note'}</h4>
            <div class="flex flex-col justify-center gap-y-4">
                <textarea 
                    rows="10"
                    class="textarea"
                    bind:value={message}
                />
                <div class="grid grid-cols-[30%_1fr] gap-x-2">
                    <button 
                        type="button"
                        class="btn btn-sm sm:btn-md bg-error-300-600-token"
                        on:click={()=> modalStore.close()}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        on:click={postTicket}
                        class="btn btn-sm sm:btn-md bg-success-300-600-token"
                        disabled={posting}
                    >
                        {#if posting}
                            <span>
                                <ProgressRadial value={undefined} stroke={60} meter="stroke-tertiary-500"
                                    track="stroke-tertiary-500/30" strokeLinecap="round" width="w-8" />
                            </span>
                        {:else}
                            <span>Post</span>
                        {/if}

                    </button>
                </div>
            </div>
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600-token">
            Error: Ticket is missing!
        </h2>
    {/if}
{/if}
