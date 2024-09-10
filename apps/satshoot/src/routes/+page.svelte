<script lang="ts">
    import ShareIcon from "$lib/components/Icons/ShareIcon.svelte";
    import StarIcon from "$lib/components/Icons/StarIcon.svelte";
    import TroubleshootIcon from "$lib/components/Icons/TroubleshootIcon.svelte";
    import BitcoinIcon from "$lib/components/Icons/BitcoinIcon.svelte";
import { loggedIn } from "$lib/stores/user";
    import BullhornIcon from "$lib/components/Icons/BullhornIcon.svelte";
    import ShieldIcon from "$lib/components/Icons/ShieldIcon.svelte";
    import ConnectionsIcon from "$lib/components/Icons/ConnectionsIcon.svelte";
    import HandshakeIcon from "$lib/components/Icons/HandshakeIcon.svelte";
    import ArrowIcon from "$lib/components/Icons/ArrowIcon.svelte";

const mainCardClasses = "card card-hover bg-surface-100-800-token p-4 " +
                    "flex flex-col items-center col-start-2 " +
                    "leading-normal sm:leading-loose";

const smallCardContainerClasses = "col-start-2 flex flex-wrap items-center " +
                                "justify-center gap-x-8 gap-y-4";
const smallCardClasses = "card card-hover bg-surface-100-800-token p-4 " +
                        "flex flex-col items-center gap-y-2";
</script>


<!-- {#if $loggedIn} -->
<!-- {/if} -->
<div class={"bg-gradient-to-br from-primary-500 to-tertiary-400 " +
            "p-8 h-full grid grid-cols-[2%_1fr_2%] " +
            "sm:grid-cols-[10%_1fr_10%] gap-y-12"}>
    <div class="{mainCardClasses}">
        <h2 class="h2 sm:h1 font-bold text-center " >
            Unstoppable Freelancing on Nostr
        </h2>
        <h3 class="h3 sm:h2 text-center m-2">
            Join the freedom economy:
        </h3>
    </div>

    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><TroubleshootIcon extraClasses={"text-2xl"}/></span>
                <span>Find Freelancers for any job</span>
            </h2>
            <div>
                Minor tasks or big-ticket projects
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><BitcoinIcon extraClasses={'text-2xl'}/></span>
                <span>Earn sats as a Freelancer</span>
            </h2>
            <div>
                Bid on Tickets with Offers, get selected and start working
            </div>
        </div>
        <!-- <span><HandshakeIcon iconType={'regular'} sizeClass={'text-xl'} /></span> -->
    </div>

    <div class="{mainCardClasses}">
        <h2 class="h2 sm:h1 font-bold text-center" >
            Leverage Your Nostr Network
        </h2>
        <h3 class="h3 sm:h2 text-center m-2">
            One account, endless possibilities:
        </h3>
    </div>
    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><ShareIcon extraClasses={'text-2xl'}/></span>
                <span>Share Tickets in Your Feed</span>
            </h2>
            <div class="text-wrap">
                {"Post jobs and issues as short text to gain visibility " +
                    " across countless nostr-apps "}
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><BullhornIcon extraClasses={'text-2xl'}/></span>
                <span>Promote Yourself Everywhere</span>
            </h2>
            <div class="text-wrap">
                {"Post about Your topics of interest whenever " +
                    "You are ready to work"}
            </div>
        </div>
    </div>
    <div class="{mainCardClasses}">
        <h2 class="h2 sm:h1 font-bold text-center" >
            Use Freedom Technology to get rid of Middle-men
        </h2>
        <h3 class="h3 sm:h2 text-center m-2">
            No centralized 3rd parties:
        </h3>
    </div>
    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><StarIcon extraClasses={'text-2xl text-warning-500'}/></span>
                <span>Build an Unstoppable Reputation</span>
            </h2>
            <ul class="list">
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        SatShoot
                        <strong>can never</strong> 
                        delete your data or 
                        <strong>censor</strong> 
                        you
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Your identity and data is 
                        <strong>portable across</strong> 
                        the 
                        <strong>Nostr </strong>
                        app-universe 
                    </span>
                </li>
            </ul>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span>
                    <ConnectionsIcon extraClasses='text-2xl text-tertiary-500'/>
                </span>
                <span>Connections You control</span>
            </h2>
            <ul class="list">
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        SatShoot
                        <strong>cannot stop You </strong> 
                        from getting a deal 
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        You can 
                        <strong>switch</strong> 
                        to another app at 
                        <strong>any time</strong> 
                        you like
                    </span>
                </li>
            </ul>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><ShieldIcon extraClasses='text-2xl'/></span>
                <span>Avoid spam and scam</span>
            </h2>
            <div class="text-wrap">
                {"Only engage with Your cryptographically verified " +
                    "Web of Trust (WoT)"}
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="h4 sm:h3">
                <span><BitcoinIcon extraClasses='text-2xl text-primary-500'/></span>
                <span>Instant and final payments in sats</span>
            </h2>
            <div class="text-wrap">
                {"lorem ipusm " +
                    " across countless nost-apps "}
            </div>
        </div>
    </div>
</div>
