<script lang="ts">
    import { currentMessage, onPromptKeyDown, sendMessage, hide } from "$lib/stores/messages";

    $: hideClass = $hide ? 'hidden' : '';
</script>
<section class="{hideClass} w-full h-14 border-t border-surface-500/30 bg-surface-100-800-token p-2">
    <div class="input-group input-group-divider grid-cols-[auto_1fr_auto] rounded-container-token">
        <button class="input-group-shim">+</button>
        <textarea
            bind:value={$currentMessage}
            class="bg-transparent border-0 ring-0 text-sm"
            name="prompt"
            id="prompt"
            placeholder="Write a message..."
            rows="1"
            on:keydown={$onPromptKeyDown}
        />
        <button class={$currentMessage ? 'variant-filled-primary' : 'input-group-shim'} on:click={$sendMessage}>
            <i class="fa-solid fa-paper-plane" />
        </button>
    </div>
</section>

