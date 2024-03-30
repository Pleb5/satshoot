import type { NDK, NDKUser, NDKSigner } from '@nostr-dev-kit/ndk';
import { loggedIn } from '../stores/login';

import { 
    myTicketFilter, myOfferFilter, myTickets, myOffers
} from "$lib/stores/troubleshoot-eventstores";

export async function initializeUser(ndk: NDK): Promise<NDKUser> {
    const user: NDKUser = await (ndk.signer as NDKSigner).user();
    if (user.npub) loggedIn.set(true);

    myTicketFilter.authors?.push(user.pubkey);
    myOfferFilter.authors?.push(user.pubkey);
    myTickets.startSubscription();
    myOffers.startSubscription();


    // UI update
    console.log('asdf')

    return user;
}
