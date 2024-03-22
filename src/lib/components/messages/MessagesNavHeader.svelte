<script lang='ts'>
    import {
        titleLink, ticketTitle, hideSearch, searchInput, searchText, contactsHeight,
        people, currentPerson, selectCurrentPerson, expandContacts,
        resetContactsList, winner, arrowDown, hideMessagesNavHeader
    } from "$lib/stores/messages";

	import { Avatar } from '@skeletonlabs/skeleton';
    import { onDestroy } from "svelte";

    onDestroy(()=>{
    });

</script>
<div class="{$hideMessagesNavHeader ? 'hidden' : ''}">
    <a class="anchor" href={$titleLink}>
        <h4 class="h4 mb-2 text-center font-bold">{$ticketTitle ?? '?'}</h4>
    </a>
    <!-- Top Navigation -->
    <div class="flex flex-col items-start md:hidden">
        <!-- Header -->
        <header class="self-center p-2">
            <input
                class="input {$hideSearch ? 'hidden' : ''}"
                type="search"
                placeholder="Search..."
                bind:value={$searchInput}
                on:keyup={$searchText}
                on:search={$searchText}
            />
        </header>
        <!-- Contact List -->
        <div class="flex flex-col items-start p-2 pb-0 space-x-2">
            <small class="opacity-50">Contacts</small>
            <div class="flex flex-col space-y-1 overflow-y-hidden {$contactsHeight}">
                {#if !$hideMessagesNavHeader && $people}
                    {#each $people as person, i}
                        <button
                            type="button"
                            class="btn w-full flex items-center space-x-4 
                            {person.pubkey === $currentPerson.pubkey
                            ? 'variant-filled-primary'
                            : 'bg-surface-hover-token'}"
                            on:click={$selectCurrentPerson(person, i)}
                        >
                            <Avatar
                                src={person.profile?.image
                                    ?? `https://robohash.org/${person.pubkey}`}
                                width="w-8"
                            />
                            <span class="flex-1 text-start {person.pubkey === $winner 
                                ? 'text-warning-400 font-bold' : ''}">
                                {person.profile?.name ?? person.npub.substring(0,15)}
                            </span>
                        </button>
                    {/each}
                {/if}
            </div>
        </div>
        <div class="flex w-full justify-center {$arrowDown ? '' : 'sticky bottom-0'}">
            <button 
                class="btn btn-icon "
                on:click={()=>{
                    if ($arrowDown) {
                        $expandContacts();
                    } else {
                        $resetContactsList();
                    }
                }}
            >
                <i class="fa-solid fa-chevron-{$arrowDown ? 'down' : 'up'} text-xl"></i>
            </button>
        </div>
    </div>
</div>
