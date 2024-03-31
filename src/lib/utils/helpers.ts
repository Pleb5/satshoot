import type { NDK, NDKUser, NDKSigner } from '@nostr-dev-kit/ndk';
import { loggedIn } from '../stores/login';
import currentUser from '../stores/login';

import { 
    myTicketFilter, myOfferFilter, myTickets, myOffers
} from "$lib/stores/troubleshoot-eventstores";

export async function initializeUser(ndk: NDK) {
    const user = await (ndk.signer as NDKSigner).user();
    if (user.npub) {
        loggedIn.set(true);
    } else return;

    currentUser.set(user);

    myTicketFilter.authors?.push(user.pubkey);
    myOfferFilter.authors?.push(user.pubkey);
    myTickets.startSubscription();
    myOffers.startSubscription();

    await user.fetchProfile();
    currentUser.set(user);
}
