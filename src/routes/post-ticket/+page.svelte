<script lang="ts">
    import { InputChip } from '@skeletonlabs/skeleton';
    import { Autocomplete } from '@skeletonlabs/skeleton';
    import type { AutocompleteOption } from '@skeletonlabs/skeleton';

    let tagInput = '';
    
const tagOptions: AutocompleteOption<string>[] = [
	{ label: 'Sparrow', value: 'sparrow', keywords: 'wallet, desktop', meta: { } },
	{ label: 'SeedSigner', value: 'seedsigner', keywords: 'hardware_wallet', meta: { } },
	{ label: 'Bitcoin Core', value: 'bitcoin_core', keywords: 'node, onchain', meta: { } },
	{ label: 'RaspiBlitz', value: 'raspiblitz', keywords: 'node, onchain, lightning', meta: { } },
	{ label: 'RoninDojo', value: 'ronindojo', keywords: 'node, onchain', meta: { } },
	{ label: 'WhirlPool', value: 'whirlpool', keywords: 'coinjoin', meta: { } },
	{ label: 'Bisq', value: 'bisq', keywords: 'dex', meta: {  } }
];
				

    let tagList: string[] = [];

    let inputChip:InputChip;

    function onTagSelection(event: CustomEvent<AutocompleteOption<string>>): void {
        let tagValue = event.detail.value;
        // Run validation checks here(dont allow duplicates, max=5 tags) 
        // and modify underlying data structure
        // Cannot explicitly call submit of InputChips component without nasty workarounds
        // Modify conditions if validity checks ever change
        if (tagList.length < 5 && tagList.includes(tagValue) === false) {
            tagList = [...tagList, tagValue];
            tagInput = '';        
        }
    }
			
</script>

<div class="card flex flex-col p-4 w-full text-token space-y-4 justify-start">
    <h1 class="h1 text-center m-4">Create Ticket</h1>

    <label class="label max-w-md">
        <span>Ticket Title(min. 10chars)</span>
        <input 
            class="input"
            type="text"
            placeholder="Title of your Ticket"
            minlength="10"
        />
    </label>


    <label class="label max-w-xl">
        <span>Ticket Description(min. 20chars)</span>
        <textarea 
            class="textarea"
            rows="4"
            placeholder="Detailed description of your issue"
            minlength="20"
        />
    </label>


    <div class="text-token w-full max-w-sm space-y-2">
        <span>Ticket Tags(max. 5pcs)</span>
        <InputChip
            bind:this={inputChip}
            bind:input={tagInput}
            bind:value={tagList}
            name="tags"
            placeholder="Enter tag value..."
            max={5}
            minlength={2}
            maxlength={20}
        />


        <div class="card w-full max-w-sm max-h-20 pb-4 overflow-y-auto" tabindex="-1">
            <Autocomplete
                bind:input={tagInput}
                options={tagOptions}
                on:selection={onTagSelection}
            />
        </div>
    </div>

</div>

<div class="flex mx-auto my-10 justify-center">
    <button type="button" class="btn max-w-sm bg-gradient-to-br variant-gradient-primary-tertiary">
        <span>Post Ticket</span>
    </button>
</div>

