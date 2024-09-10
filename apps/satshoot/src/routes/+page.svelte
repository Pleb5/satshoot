<script lang="ts">
    import ShareIcon from "$lib/components/Icons/ShareIcon.svelte";
    import StarIcon from "$lib/components/Icons/StarIcon.svelte";
    import TroubleshootIcon from "$lib/components/Icons/TroubleshootIcon.svelte";
    import BitcoinIcon from "$lib/components/Icons/BitcoinIcon.svelte";
import { loggedIn } from "$lib/stores/user";
    import BullhornIcon from "$lib/components/Icons/BullhornIcon.svelte";
    import ShieldIcon from "$lib/components/Icons/ShieldIcon.svelte";
    import ConnectionsIcon from "$lib/components/Icons/ConnectionsIcon.svelte";

const baseClasses = "card card-hover bg-surface-100-800-token p-4 " +
                    "flex flex-col items-center col-start-2 " +
                    "leading-normal sm:leading-loose";
</script>


<!-- {#if $loggedIn} -->
<!-- {/if} -->
<div class={"bg-gradient-to-br from-primary-500 to-tertiary-400 " +
            "p-8 h-full grid grid-cols-[2%_1fr_2%] " +
            "sm:grid-cols-[10%_1fr_10%] gap-y-12"}>
    <div class="{baseClasses}">
        <h2 class="h2 sm:h1 font-bold text-center " >
            Unstoppable Freelancing on Nostr
        </h2>
        <h3 class="h3 sm:h2 text-center m-2">
            Join the freedom economy:
        </h3>
        <ul class="list">
            <li>
                <span><TroubleshootIcon /></span>
                <span>Troubleshooting in minutes</span>
            </li>
            <li>
                <span><i class="fa-regular fa-handshake"></i></span>
                <span>Find freelancers for bigger projects</span>
            </li>
            <li>
                <span><BitcoinIcon /></span>
                <span>Earn sats as a freelancer</span>
            </li>
        </ul>
    </div>

    <div class="{baseClasses}">
        <h2 class="h2 sm:h1 font-bold text-center" >
            Leverage Your Social Network like never before
        </h2>
        <ul class="list">
            <li>
                <span><StarIcon /></span>
                <span>Build an Unstoppable Reputation</span>
            </li>
            <li>
                <span><ShareIcon /></span>
                <span>Share Problems on Your feed</span>
            </li>
            <li>
                <span><BullhornIcon /></span>
                <span>Promote Yourself across Nostr</span>
            </li>
        </ul>
    </div>

    <div class="{baseClasses}">
        <h2 class="h2 sm:h1 font-bold text-center" >
            Use Freedom Technology to get rid of Middle-men
        </h2>
        <ul class="list">
            <li>
                <span><ConnectionsIcon extraClasses='text-xl text-tertiary-500'/></span>
                <span>Guaranteed freedom of connection</span>
            </li>
            <li>
                <span><ShieldIcon extraClasses='text-xl text-warning-500'/></span>
                <span>Eliminate spam and scam</span>
            </li>
            <li>
                <span><BitcoinIcon extraClasses='text-xl text-primary-500'/></span>
                <span>Instant and final payments in sats</span>
            </li>
        </ul>
    </div>
</div>
