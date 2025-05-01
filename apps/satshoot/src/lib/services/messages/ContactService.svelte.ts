import { get } from 'svelte/store';
import { NDKEvent, type NDKUser } from '@nostr-dev-kit/ndk';
import ndk from '$lib/stores/session';

/**
 * Interface for Contact data
 */
interface Contact {
    person: NDKUser;
    selected: boolean;
}

/**
 * Interface for Profile data
 */
interface Profile {
    person: NDKUser;
    name?: string;
    image?: string;
}

/**
 * Service for handling contacts and profiles
 */
export class ContactService {
    // Public state exposed for direct access
    contacts = $state<Contact[]>([]);
    profiles = $state<Profile[]>([]);
    currentPerson = $state<NDKUser | undefined>(undefined);
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
            this.addPerson(ndkInstance.getUser({ pubkey: jobPubkey }), false);
        }

        // If we have a specific person to select
        if (offerMakerToSelect && offerMakerToSelect !== currentUserPubkey) {
            const person = ndkInstance.getUser({ pubkey: offerMakerToSelect });
            this.addPerson(person, true);
            this.currentPerson = person;
        } else if (selectedPersonString && selectedPersonString.split('$')[1] === this.jobAddress) {
            const pubkey = selectedPersonString.split('$')[0];
            const person = ndkInstance.getUser({ pubkey });
            this.addPerson(person, true);
            this.currentPerson = person;
        }
    }

    /**
     * Add a new person to contacts
     */
    addPerson(person: NDKUser, selected: boolean = false) {
        // Check if person already exists
        const existingIndex = this.contacts.findIndex((c) => c.person.pubkey === person.pubkey);

        if (existingIndex >= 0) {
            // Update existing contact if needed
            if (selected && !this.contacts[existingIndex].selected) {
                // Create a new array with the updated contact
                const updatedContacts = [...this.contacts];
                updatedContacts[existingIndex] = {
                    ...updatedContacts[existingIndex],
                    selected: true,
                };
                this.contacts = updatedContacts;
            }
        } else {
            // Add new contact
            this.contacts = [...this.contacts, { person, selected }];
        }

        // Also fetch and add profile
        this.fetchAndAddProfile(person);

        return person;
    }

    /**
     * Add people from an array of pubkeys
     */
    addPeopleFromPubkeys(pubkeys: string[]) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        pubkeys.forEach((pubkey) => {
            this.addPerson(ndkInstance.getUser({ pubkey }), false);
        });
    }

    /**
     * Add a person from a message
     */
    addPersonFromMessage(message: NDKEvent, currentUserPubkey: string) {
        const ndkInstance = get(ndk);
        if (!ndkInstance) return;

        // Get the peer pubkey (either sender or recipient)
        const pPubkey = this.getPeerPubkeyFromMessage(message, currentUserPubkey);
        if (pPubkey && pPubkey !== currentUserPubkey) {
            this.addPerson(ndkInstance.getUser({ pubkey: pPubkey }), false);
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
    private async fetchAndAddProfile(person: NDKUser) {
        if (this.profiles.some((profile) => profile.person.pubkey === person.pubkey)) return;

        try {
            await person.fetchProfile();

            const newProfile: Profile = {
                person,
                name: (person.profile?.name as string) || (person.profile?.display_name as string),
                image: (person.profile?.picture as string) || (person.profile?.image as string),
            };

            // Add new profile
            this.profiles = [...this.profiles, newProfile];
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    }

    /**
     * Select a person by pubkey
     */
    selectPersonByPubkey(pubkey: string) {
        const contact = this.contacts.find((c) => c.person.pubkey === pubkey);

        if (contact) {
            this.selectCurrentPerson(contact);
            return true;
        }

        return false;
    }

    /**
     * Select a person as the current contact
     */
    selectCurrentPerson(contact: Contact) {
        // Update current person
        this.currentPerson = contact.person;

        // Update selected state in contacts
        this.contacts = this.contacts.map((c) => ({
            ...c,
            selected: c.person.pubkey === contact.person.pubkey,
        }));
    }
}
