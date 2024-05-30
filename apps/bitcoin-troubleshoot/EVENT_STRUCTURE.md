# Structure of app-specific events used in Bitcoin Troubleshoot


## Ticket event
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Bitcoiner>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32767,
    "tags": [
        // A title for the ticket | string, mandatory
        ["title", <title string>]

        // Update/Replacement is based on this. Allows for multiple replaceable tickets
        ["d", <ticket ID | integer, mandatory>],

        // Allows for indexing/filtering | string, optional
        ["t", <tag1>],
        ["t", <tag2>],
                ...
        ["t", <tagN>],

        // Public key of preferred troubleshooters. Allows for more fine-tuned discovery | optional
        ["p", <hex public key1>],
        ["p", <hex public key2>],
                ...
        ["p", <hex public keyN>],

        // Preferred languages of the Bitcoiner | string, optional
        ["languages",<language1>, <language2>, ..., <languageN>],

        // Milestones if the Bitcoiner wants to define multiple steps for the ticket | string, optional
        ["milestones", <milestone1>, <milestone2>, ...,<milestoneN> ],

        ["s", <0(new) OR 1(in progress) OR 2(Resolved) or 3(Failed)>],

        // If Bitcoiner accepts an offer she SHOULD set this tag
        ["a", 32768:<hex pubkey of Troubleshooter>:<Offer ID from a d-tag of an offer>],
    ],
    "content": {
        <detailed description of the ticket | string, mandatory>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
}
```

## Offer event
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Troubleshooter>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32768,
    "tags": [
        // Replacement is based on this. Allows for multiple updatable/replaceable offers
        ["d", <offer ID, integer, mandatory>],
        ["a", 32767:<hex pubkey of Bitcoiner>:<ticket ID from a d-tag of a ticket>, mandatory>],
        ["pricing", <pricing strategy, MUST be either 0(absolute price), 1(sats/minute) or 2(sats/milestone), integer, mandatory>],
        // Amount of the price. If more than 1 amount, then it refers to the milestones of the ticket respectively. Else refers to the sats/minute or absolute price | mandatory
        ["amount", [<amount1>, <amount2>, ..., amountN>]]
    ],
    "content": {
        <Cover letter for the offer, string, optional>, 
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
}
```

## Review events
### Rationale: Web of Trust and Reviews
In addition to the Web of Trust(WoT) weeding out untrusted people and spam, Bitcoin Troubleshoot
uses Review events similar to NIP32 in order to bootstrap a reputation network of Troubleshooters
and Clients. After a Troubleshooting experience both parties rate each other so everyone has more
confidence in the future that the counterparty is trustworthy enough.

Filtering is based on the user's local perspective (follows, mutes and reports of himself and
his follows, bootstrapped with the Bitcoin Troubleshoot nostr acccount).
Filtered pubkeys don't show up on the Ticket feed nor are his Offers listed,
and his direct messages are not shown either.

There is no filtering based on the Review events though. These are just to signal
reputation in the specific domain of Troubleshooting. However, Review events themselves
ARE filtered by the user's Web of Trust so it is hard to game these scores.
This also means that reputation is local to the User of the app and is heavily
dependent on the User's ability to build a trustworthy follow list.

### QTS: Qualitative Thumb System
The rating system used in Bitcoin Troubleshoot is based on [QTS](https://habla.news/u/arkinox@arkinox.tech/DLAfzJJpQDS4vj3wSleum).
This hopefully captures users' sentiments better than 'five-star' systems and 
allows for better overall UX around this feature.

Total score in either the Troubleshooter's or the Client's case is between [0, 1].
The outcome of the Ticket (state = Resolved/Failed) determines half the score
for the Troubleshooter. The other half is determined by qualities of excellence,
- Expertise
- Availability
- Communication
The overall score is skewed slightly towards Expertise.

For the Clients it is harder to capture specific qualities, so an overall thumbs up/down
from the Troubleshooter determines half the score and the Client can also receive extra
points for excellence in communication and availability.

### Troubleshooter Review event
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Bitcoiner>,
    "created_at": <unix timestamp in seconds>,
    "kind": 1986,
    "tags": [
        ["L", qts/troubleshooting]
        ["l", “troubleshooter”, “qts/troubleshooting”],
        ["rating", “<0 | 0.5>”, “troubleshooter/success”], 
        ["rating", “<0 | 0.2>”, “troubleshooter/expertise”], 
        ["rating", “<0 | 0.15>”, “troubleshooter/availability”], 
        ["rating", “<0 | 0.15>”, “troubleshooter/communication”], 
        ["a", 32768:<hex pubkey of Troubleshooter>:<Offer d-tag>],
    ],
    "content": {
        <Short summary of the experience>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
}
```

### Client Review event
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Bitcoiner>,
    "created_at": <unix timestamp in seconds>,
    "kind": 1986,
    "tags": [
        ["L", qts/troubleshooting]
        ["l", “client”, “qts/troubleshooting”],
        ["rating", “<0 | 0.5>”, “client/thumb”], 
        ["rating", “<0 | 0.25>”, “client/availability”], 
        ["rating", “<0 | 0.25>”, “client/communication”], 
        ["a", 32767:<hex pubkey of the Client>:<Ticket d-tag>],
    ],
    "content": {
        <Short summary of the experience>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
}
```
