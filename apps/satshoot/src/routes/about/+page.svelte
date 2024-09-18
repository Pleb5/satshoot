<script lang="ts">
    import { onMount } from "svelte";

    onMount(()=>{
        const elemPage:HTMLElement = document.querySelector('#page') as HTMLElement;
		elemPage.scrollTo({ top: elemPage.scrollHeight*(-1), behavior:'instant' });
    });
</script>

<h2 class="h2 text-center my-2">About SatShoot</h2>
<h4 class="h4 text-center">What is SatShoot?</h4>
<div class="card mx-10 mt-1 p-2">
    <p>
        SatShoot is a free and open-source freelance-app on Nostr. 
    </p>
    <span>Check out the source code and contribute on</span>
    <a href="https://github.com/Pleb5/satshoot">
        <span><i class="fa-brands fa-github">GitHub</i></span>
    </a>

</div>

<h4 class="h4 text-center mt-4">So how does this work in action?</h4>
<div class="card mx-10 mt-1 p-2">
    <p>
        Let's take the example of Alice who is a bitcoiner and has a problem with her node.
        She cannot connect to it from her Wallet Software. She creates a 'Ticket' in 
        SatShoot and posts it on Nostr. Now anyone who has a clue how to solve her 
        problem can bid on it with an 'Offer'. This Offer contains the price of the Job.
    </p>

    <p class="mt-2">
        Bob who is deeper down the rabbit hole finds this Ticket in the feed and bids on it with an Offer. 
        Alice received a bunch of Offers from different bitcoiners but she trusts Bob the most and finds his 
        price affordable. She accepts Bob's Offer. They can now resolve the node issue via encrypted chat in 
        SatShoot or they can just switch to a different app for the actual Freelancing part.
    </p>

    <p class="mt-2">
        Bob successfully helped Alice with her problem. He can now receive the payment they agreed on. They also post good reviews about their experience. Payments and Reviews are public on Nostr so Bob and Alice became more trustworthy for people in their respective Nostr-based Web of Trust.
    </p>
</div>


<h4 class="h4 text-center mt-4">How is this better than other solutions?</h4>
<div class="card mx-10 mt-1 p-2">
    <p>
        There are many freelancer solutions out there. I believe however, 
        that a dedicated Nostr solution is the best way to go for several reasons:
    </p>
    <ul>
        <li>- The Nostr ecosystem is already full of people eager to help and seek help</li>
        <li class="mt-1">- With Nostr you don't tie yourself to a particular individual or company. Anyone can deal with anyone, any time, from anywhere, without permission</li>
        <li class="mt-1">- You can use your social graph on Nostr to find trustworthy Clients / Freelancers</li>
        <li class="mt-1">- Your connections and Reputation is not captured in the app. It is stored on Nostr Relays accessible by any other app. You are unstoppable</li>
        <li class="mt-1">- Nostr allows for such a symbiosis between apps that a legacy solution will never be able to provide. All actions taken in SatShoot can be visible on any other Nostr-app</li>
        <li class="mt-1">- Nostr found a nice tradeoff-balance where reliable services can be built with freedom in focus, empowering end-users and fostering open competition as a result</li>
        <li class="mt-1">- With Nostr, You hold your keys to Your online identity and data. You are in full control</li>
    </ul>
</div>
