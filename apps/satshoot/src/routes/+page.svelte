<script lang="ts">
import ShareIcon from "$lib/components/Icons/ShareIcon.svelte";
import StarIcon from "$lib/components/Icons/StarIcon.svelte";
import FreelanceIcon from "$lib/components/Icons/FreelanceIcon.svelte";
import BitcoinIcon from "$lib/components/Icons/BitcoinIcon.svelte";
import BullhornIcon from "$lib/components/Icons/BullhornIcon.svelte";
import ShieldIcon from "$lib/components/Icons/ShieldIcon.svelte";
import ConnectionsIcon from "$lib/components/Icons/ConnectionsIcon.svelte";
import ArrowIcon from "$lib/components/Icons/ArrowIcon.svelte";
import QuestionIcon from "$lib/components/Icons/QuestionIcon.svelte";
import { loggedIn } from "$lib/stores/user";
import { hideAppBarsStore } from '$lib/stores/gui';
import { beforeNavigate, goto } from "$app/navigation";
import { onMount } from "svelte";

const satshootHeaderClasses = "h1 text-center text-primary-500";

const mainCardClasses = "text-white p-4 " +
                    "flex flex-col items-center col-start-2 " +
                    "leading-normal sm:leading-loose";

const smallCardContainerClasses = "col-start-2 flex flex-wrap items-center " +
                                "justify-center gap-x-8 gap-y-4";
const smallCardClasses = "card card-hover bg-surface-100-800-token p-4 " +
                        "flex flex-col items-center gap-y-2 w-[80vw] sm:w-[40vw]";
const smallCardHeaderClasses = "h4 sm:h3 text-center"

function start() {
    goto('/landing-step-2');
}

$: if ($loggedIn) goto('/ticket-feed');

onMount(()=>{
    // Hide app bars
    $hideAppBarsStore = true;
});

beforeNavigate(() => $hideAppBarsStore = false);

</script>


<div class={"bg-gradient-to-br from-primary-500 to-tertiary-400 " +
            "p-8 h-full grid grid-cols-[2%_1fr_2%] " +
            "sm:grid-cols-[10%_1fr_10%] gap-y-2"}>
    <div class="col-start-2 px-8 py-4 flex justify-center">
        <div class="flex flex-col items-center">
            <div class=" card p-4 flex gap-x-4 items-center bg-white ">
                <img src="/satshoot.svg" alt="logo" />
                <h1 class="{satshootHeaderClasses}">
                    SatShoot
                </h1>
            </div>
            <h2 class="h2 text-center text-white">Freedom of Work</h2>
        </div>
    </div>
    <div class="{mainCardClasses}">
        <h2 class="h2 sm:h1 font-bold text-center " >
            Unstoppable Freelancing on Nostr
        </h2>
        <h3 class="h3 sm:h2 text-center mt-2">
            Join the freedom economy
        </h3>
    </div>
    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
                <span><FreelanceIcon extraClasses={"text-2xl"}/></span>
                <span>Find Freelancers for any job</span>
            </h2>
            <div>
                Minor tasks or big-ticket projects
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
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
        <h3 class="h3 sm:h2 text-center ">
            One account, endless possibilities:
        </h3>
    </div>
    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
                <span><ShareIcon extraClasses={'text-2xl'}/></span>
                <span>Share Tickets in Your Feed</span>
            </h2>
            <div class="text-wrap">
                <span>
                    <strong>Post </strong> 
                    jobs and issues as short text to gain visibility
                    <strong>across nostr-apps</strong> 
                </span>
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
                <span><BullhornIcon extraClasses={'text-2xl'}/></span>
                <span>Promote Yourself Everywhere</span>
            </h2>
            <div class="text-wrap">
                {"Post about Your topics of interest whenever " +
                    "You are ready to work"}
            </div>
        </div>
    </div>

    <div class="col-start-2 flex justify-center">
    <button
        type="button"
        class="btn btn-lg col-start-2 w-[80vw] sm:w-[60vw] lg:w-[40vw] font-bold bg-success-500"
        on:click={start}
    >
        Try SatShoot
    </button>
    </div>

    <div class="{mainCardClasses}">
        <h2 class="h2 sm:h1 font-bold text-center" >
            Use Freedom Technology to get rid of Middle-men
        </h2>
        <h3 class="h3 sm:h2 text-center">
            No centralized 3rd parties:
        </h3>
    </div>
    <div class="{smallCardContainerClasses}">
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
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
            <h2 class="{smallCardHeaderClasses}">
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
            <h2 class="{smallCardHeaderClasses}">
                <span><ShieldIcon extraClasses='text-2xl'/></span>
                <span>Avoid spam and scam</span>
            </h2>
            <ul class="list">
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Only engage with your cryptographically verified 
                        <strong>Web of Trust (WoT)</strong> 
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Exclude bad actors based on your follows, mutes and reports
                        across all nostr-apps
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Select the best clients and freelancers based on reviews
                        and other metrics
                    </span>
                </li>
            </ul>
            <div class="text-wrap">
            </div>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
                <span><BitcoinIcon extraClasses='text-2xl text-primary-500'/></span>
                <span>Instant and final payments</span>
            </h2>
            <ul class="list">
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Pay and earn in sats using  
                        <strong>Lightning </strong> 
                        (and soon 
                        <strong>eCash)</strong> 
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        <strong>Instant, direct payments. No chargeback risk.</strong> 
                    </span>
                </li>
            </ul>
        </div>
        <div class="{smallCardClasses}">
            <h2 class="{smallCardHeaderClasses}">
                <span><QuestionIcon extraClasses='text-2xl text-tertiary-500'/></span>
                <span>So what's the catch?</span>
            </h2>

            <div>
                <span>
                    <span class="text-primary-700 font-bold">SatShoot</span> is a  
                    <a class="anchor" href="https://github.com/Pleb5/satshoot">
                        <strong>FOSS </strong>
                    </a> 
                    project but there are some ways to  
                    <strong>pledge </strong> 
                    your support:
                </span>
            </div>
            <ul class="list">
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Freelancers can pledge a chosen percentage of 
                        their reward to SatShoot
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Clients can pledge an arbitrary fixed amount after 
                        successfully closed deals
                    </span>
                </li>
                <li>
                    <span><ArrowIcon  sizeClass={'text-xl'}/></span>
                    <span>
                        Extra paid services may be introduced in the future. 
                        These will be non-essential, opt-in but handy features.
                    </span>
                </li>
            </ul>
        </div>
    </div>
    <div class="col-start-2 flex justify-center">
        <button
            type="button"
            class="btn btn-lg col-start-2 w-[80vw] sm:w-[60vw] lg:w-[40vw] font-bold bg-success-500"
            on:click={start}
        >
            Let's Do This
        </button>
    </div>
</div>
