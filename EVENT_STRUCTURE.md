# Freealance-related events used in SatShoot
## Freelance Events: Orders on a Service (Many-to-One) and Bids on a Job (Many-to-One)
### Freelance Service event (Posted by Freelancers)
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Freelancer>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32765,
    "tags": [
        // Update/Replacement is based on this. Allows for multiple Services with simple edits. Mandatory
        ["d", "<Service ID>"],

        // A title for the Service. Mandatory
        ["title", "<title>"]

        // Category Labels. Optional
        ["t", <tag1>],
        ["t", <tag2>],
                ...
        ["t", <tagN>],

        // Pricing Strategy: Absolute or Time-based. Mandatory
        ["pricing", <'0'(sats) | '1'(sats/minute)>],

        // Amount of the price. Refers to the absolute price OR sats/minute. Mandatory
        ["amount", <'0' | '1'>]

        // Status. Deactivation indicates that this Service is not offered anymore
        // while preserves its history. Mandatory
        [ "s", <'0' (InActive) OR '1' (Active)> ],

        // If a Freelancer is ready to fullfill a Freelance Order he SHOULD set this.
        // Multiple a-tags mean that this Service has been sold multiple times
        ["a", "32766:<hex pubkey of Client1>:<Freelance Order d-tag>"],
        ["a", "32766:<hex pubkey of Client2>:<Freelance Order d-tag>"],
        
        // Tag if Freelancer wants to share public payments (zaps) on this Service
        // These can be percentage ratios adding up to 100%. Optional
        ["zap", "<Freelancer pubkey>", "<relay hint>", "95"]
        ["zap", "<Supported pubkey (e.g. app dev)>", "<relay hint>", "5"]
    ],
    "content": {
        <detailed description of the Service. Mandatory>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the
    serialized event data, which is the same as the "id" field>
}
```

### Freelance Order (Posted by Client)
```json

{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Client>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32766,
    "tags": [
        // Update/Replacement is based on this. Allows for multiple Orders with simple edits. Mandatory
        ["d", "<Order id>"],

        // Clients can change their mind about a Service while its not being fulfilled. Mandatory
        [ "s", <'0' (InActive) OR '1' (Active)> ],

        // This tag MUST be set on creation of this event. Points to the 
        // Freelance Service that the Client wants to order. Mandatory
        ["a", "32768:<hex pubkey of Freelancer>:<Freelance Service d-tag>"],
    ],
    "content": {
        <A Note for the Freelancer selling the Service. Optional>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash
    of the serialized event data, which is the same as the "id" field>
}

```

### Freelance Job event (Posted by Client)
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Client>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32767,
    "tags": [
        // A title for the Job. Mandatory
        ["title", "<title>"]

        // Update/Replacement is based on this. Allows for multiple Jobs with simple edits. Mandatory
        ["d", "<Job id>"],

        // Category Labels, max 5 recommended. Optional
        ["t", "<tag1>"],
        ["t", "<tag2>"],
                ...
        ["t", "<tagN>"],

        // Job status. "New" while Job is taking Bids, "In-Progress" as soon as a Bid
        is taken, and "Resolved/Failed" when the Job is concluded
        [ "s", <'0' (New) OR '1' (In Progress) OR '2' (Resolved) OR '3' (Failed)> ],

        // If Client accepts a Freelance Bid he SHOULD set this tag
        ["a", "32768:<hex pubkey of Freelancer>:<Freelance Bid d-tag>"],
    ],
    "content": {
        <detailed description of the Job, mandatory>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash
    of the serialized event data, which is the same as the "id" field>
}
```

### Freelance Bid (Posted by the Freelancer on a specific Job)
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Freelancer>,
    "created_at": <unix timestamp in seconds>,
    "kind": 32768,
    "tags": [
        // Replacement is based on this. Allows for multiple Bids with simple edits. Mandatory
        ["d", "<Bid ID>"],

        // Pricing Strategy: Absolute or Time-based. Mandatory
        ["pricing", <'0'(sats) | '1'(sats/minute)>],

        // Amount of the price. Refers to the absolute price OR sats/minute. Mandatory
        ["amount", <'0' | '1'>]

        Freelancer MUST set this tag when bidding on a Job. Mandatory
        ["a", "32767:<hex pubkey of Client>:<Job d-tag of a Job>">],

        // Tag if Freelancer wants to share public payments (zaps) on this Service
        // These can be percentage ratios adding up to 100%. Optional
        ["zap", "<Freelancer pubkey>", "<relay hint>", "95"]
        ["zap", "<Supported pubkey (e.g. app dev)>", "<relay hint>", "5"]
    ],
    "content": {
        <Pitch explaining why Freelancer is the right fit for the Job. Optional>, 
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash
    of the serialized event data, which is the same as the "id" field>
}
```

## Review events
### QTS: Qualitative Thumb System
The rating system used in SatShoot is based on NIP32 labels and the [QTS](https://habla.news/u/arkinox@arkinox.tech/DLAfzJJpQDS4vj3wSleum) review-system.
This hopefully captures users' sentiments better than 'five-star' systems and 
allows for better overall UX around this feature.

Total score in either the Freelancer's or the Client's case is between [0, 1].
One half is determined by the overall outcome / experience with the counterparty,
and excellence labels make up the other half of the score. This allows for labels
to contribute to the overall rating consensus while this also allows for distinguishing 
Clients and Freelancers by their outstanding attributes.

### Freelancer Review event (posted by Client)
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Client>,
    "created_at": <unix timestamp in seconds>,
    "kind": 1986,
    "tags": [
        // ALL tags are mandatory
        ["L", qts/freelancing]
        ["l", “freelancer”, “qts/freelancing”],
        ["rating", “<0 | 0.5>”, “success”], 
        ["rating", “<0 | 0.2>”, “expertise”], 
        ["rating", “<0 | 0.15>”, “availability”], 
        ["rating", “<0 | 0.15>”, “communication”], 
        ["a", 32768:<hex pubkey of Freelancer>:<Bid/Service d-tag>],
    ],
    "content": {
        <Short summary of the experience. Optional>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the
    serialized event data, which is the same as the "id" field>
}
```

### Client Review event (posted by Freelancer)
```json
{
    "id": <32-bytes lowercase hex-encoded sha256 of the serialized event data>,
    "pubkey": <hex public key of the Freelancer>,
    "created_at": <unix timestamp in seconds>,
    "kind": 1986,
    "tags": [
        // ALL tags are mandatory
        ["L", qts/freelancing]
        ["l", “client”, “qts/freelancing”],
        ["rating", “<0 | 0.5>”, “thumb”], 
        ["rating", “<0 | 0.25>”, “availability”], 
        ["rating", “<0 | 0.25>”, “communication”], 
        ["a", 32767:<hex pubkey of the Client>:<Job/Order d-tag>],
    ],
    "content": {
        <Short summary of the experience. Optional>
    },
    "sig": <64-bytes lowercase hex of the signature of the sha256 hash of the
    serialized event data, which is the same as the "id" field>
}
```
