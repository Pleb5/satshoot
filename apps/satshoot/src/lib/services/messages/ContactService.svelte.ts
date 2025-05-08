import { get } from 'svelte/store';
import { NDKEvent, type NDKUser } from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';

/**
 * Interface for Profile data
 */
interface Profile {
    name?: string;
    image?: string;
}

/**
 * Interface for Contact data
 */
interface Contact {
    person: NDKUser;
    profile?: Profile;
    selected: boolean;
}

/**
 * Service for handling contacts and profiles
 */
export class ContactService {
    // Public state exposed for direct access
    contacts = $state<Contact[]>([]);
    currentContact = $derived(
        this.contacts.find((c) => c.selected === true)
        || undefined
    );
    winnerPubkey = $state<string>('');

    private jobAddress: string;

    constructor(jobAddress: string) {
        this.jobAddress = jobAddress;
    }

    /**
     * Set the winner pubkey
     */
    setWinnerPubkey(pubkey: string) {
        this.winnerPubkey = pubkey;
    }

    /**
     * Add initial contacts
     */
    addInitialContacts(
        jobPubkey: string,
        currentUserPubkey: string,
        offerMakerToSelect: string,
        selectedPersonString: string
    ) {
        const ndkInstance = get(ndk);

        // Add job owner
        if (jobPubkey && jobPubkey !== currentUserPubkey) {
            const person = ndkInstance.getUser({ pubkey: jobPubkey });
            this.addContact({person, selected: false});
        }

        // If we have a specific person to select
        if (offerMakerToSelect && offerMakerToSelect !== currentUserPubkey) {
            const person = ndkInstance.getUser({ pubkey: offerMakerToSelect });
            const contact = {person, selected: false}
            this.addContact(contact);
            this.selectCurrentContact(contact)
        } else if (selectedPersonString && selectedPersonString.split('$')[1] === this.jobAddress) {
            const pubkey = selectedPersonString.split('$')[0];
            const person = ndkInstance.getUser({ pubkey });
            const contact = {person, selected: false};
            this.addContact(contact);
            this.selectCurrentContact(contact);
        }
    }

    /**
     * Add a new person to contacts
     */
    addContact(contact: Contact) {
        // Check if person already exists
        const contactAlreadyAdded = this.contacts.some(
            (c) => c.person.pubkey === contact.person.pubkey
        );

        if (contactAlreadyAdded) return;

        // Add new contact
        this.contacts = [...this.contacts, contact];
        // Also fetch and add profile
        this.fetchAndAddProfile(contact);
    }

    /**
     * Add people from an array of pubkeys
     */
    addPeopleFromPubkeys(pubkeys: string[]) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        pubkeys.forEach((pubkey) => {
            const person = ndkInstance.getUser({ pubkey })
            this.addContact({person, selected: false});
        });
    }

    /**
     * Add a person from a message
     */
    addContactFromMessage(message: NDKEvent, currentUserPubkey: string) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        // Get the peer pubkey (either sender or recipient)
        const pPubkey = this.getPeerPubkeyFromMessage(
            message, currentUserPubkey
        );

        if (pPubkey && pPubkey !== currentUserPubkey) {
            const person = ndkInstance.getUser({ pubkey: pPubkey });
            this.addContact({person, selected: false});
        }
    }

    /**
     * Get peer pubkey from a message
     */
    private getPeerPubkeyFromMessage(
        message: NDKEvent,
        currentUserPubkey: string
    ): string | undefined {
        // If the message is from someone else, return their pubkey
        if (message.pubkey !== currentUserPubkey) {
            return message.pubkey;
        }

        // If the message is from the current user, return the recipient pubkey
        const pTag = message.tags.find((tag) => tag[0] === 'p');
        return pTag?.[1];
    }

    /**
     * Fetch and add profile for a person
     */
    private async fetchAndAddProfile(contact: Contact) {
        if (contact.profile) return;

        try {
            await contact.person.fetchProfile();

            const newProfile: Profile = {
                name: (contact.person.profile?.name as string) 
                    || (contact.person.profile?.display_name as string),
                image: (contact.person.profile?.picture as string) 
                    || (contact.person.profile?.image as string),
            };

            // Add new profile
            contact.profile = newProfile;
            console.log('added new profile!', contact)
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    }

    /**
     * Select a person by pubkey
     */
    selectContactByPubkey(pubkey: string) {
        const contact = this.contacts.find(
            (c) => c.person.pubkey === pubkey
        );

        if (contact) {
            this.selectCurrentContact(contact);
            return true;
        }

        return false;
    }

    /**
     * Select a person as the current contact
     */
    selectCurrentContact(contact: Contact) {
        // Update selected state in contacts
        this.contacts = this.contacts.map((c) => ({
            ...c,
            selected: c.person.pubkey === contact.person.pubkey,
        }));
        console.log('selected current person:', this.currentContact)
    }
}
