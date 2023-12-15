<script lang="ts">
    // Import the package
    import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
    import { browser } from '$app/environment';
    import {NDKNip07Signer} from "@nostr-dev-kit/ndk";


    const signer = new NDKNip07Signer();

    // Create a new NDK instance with explicit relays
    const ndk = new NDK({
        // signer: signer,
        explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.snort.social"],
    });

    if (browser) {
        ndk.connect().then(() => {
            console.log('Connected');
        });
    }

    const user = ndk.getUser({
        npub: 'npub16p8v7varqwjes5hak6q7mz6pygqm4pwc6gve4mrned3xs8tz42gq7kfhdw'
    });

    console.log(user);

    // const eventpromise = ndk.fetchEvents({ kinds: [1], authors: [user.pubkey] });
    //
    async function login () {
       signer.user().then(async (user) => {
            if (!!user.npub) {
                console.log("Permission granted to read user public key: ", user.npub);
            }
        });
    }

    function publishTroubleshootEvent() {
        const troubleshootEvent = new NDKEvent(ndk);
        
        troubleshootEvent.kind = 32767;
        troubleshootEvent.content = "SOS help me I have to withdraw my funds from the exchange!";

        troubleshootEvent.publish();
    }


</script>

<h1> Bitcoin troubleshoot </h1>

<button on:click={login}>Log in with NIP07</button>


<button on:click={publishTroubleshootEvent}>Ask for help</button>

<!-- {#await user.fetchProfile() then events} -->
<!--     <h2>{user.profile?.name}</h2> -->
<!--     <p> -->
<!--         <img src={user.profile?.image} style="width:100px; height:100px;" alt="five_npub" /> -->
<!--     </p> -->
<!--     <p>{user.profile?.about}</p> -->
<!-- {/await} -->




<!-- {#await eventpromise then events} -->
<!--     {#each Array.from(events) as event} -->
<!--         <div class=eventBlock> -->
<!--             <p>{event.content}</p> -->
<!---->
<!--         </div> -->
<!--     {/each} -->
<!-- {/await} -->
<!---->
<!-- <style> -->
<!--     .eventBlock { -->
<!--         padding:10px; -->
<!--         border:1px black; -->
<!--         border-radius:10px; -->
<!--         margin-bottom: 4px; -->
<!--     } -->
<!-- </style> -->
