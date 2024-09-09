<script lang="ts">
import { loggedIn } from "$lib/stores/user";

const baseClasses = "card card-hover bg-surface-200-700-token m-8 p-4 " +
                    "flex flex-col items-center";
</script>


<!-- {#if $loggedIn} -->
<!-- {/if} -->
<div class="{baseClasses}">
    <h2 class="h2 sm:h1 font-bold text-center" >
        Unstoppable Freelancing on Nostr
    </h2>
    <h3 class="h3 sm:h2 text-center m-2">
        Join the freedom economy:
    </h3>
    <ul class="list">
        <li>Get remote help in minutes</li>
        <li>Earn sats as a freelancer</li>
    </ul>
</div>

<div class="{baseClasses}">
    <h2 class="h2 sm:h1 font-bold text-center" >
        Leverage Your Social Network like never before
    </h2>
    <ul class="list">
        <li>Build Your Unstoppable Reputation</li>
        <li>Share your Tickets and Promote yourself across Nostr</li>
        <li>Instant and final payments in sats</li>
    </ul>
</div>

<div class="{baseClasses}">
    <h2 class="h2 sm:h1 font-bold text-center" >
        Use Freedom Technology to get rid of Middle-men
    </h2>
    <ul class="list">
        <li>Guaranteed freedom of connection with Nostr</li>
        <li>Instant and final payments in sats using Lightning or eCash</li>
    </ul>
</div>
