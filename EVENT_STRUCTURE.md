# Freealance-related events used in SatShoot

## Freelance Events: Orders on a Service (Many-to-One) and Bids on a Job (Many-to-One)

### Freelance Service event (Posted by Freelancers)

```json
{
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

        // Images for the Service. Multiple images allowed
        ["image", <URL of image1 for this Service>],
        ["image", <URL of image2 for this Service>],
                ...
        ["image", <URL of imageN for this Service>],

        // Pricing Strategy: Absolute or Time-based. Mandatory
        ["pricing", <'0'(sats) | '1'(sats/minute)>],

        // Price of service. Refers to the absolute price OR sats/minute. Mandatory
        ["amount", <100>]

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
    }
}
```

### Freelance Order (Posted by Client)

```json

{
    "kind": 32766,
    "tags": [
        // Update/Replacement is based on this. Allows for multiple Orders with simple edits. Mandatory
        ["d", "<Order id>"],

        // Mandatory. Clients place an Order on a Service and the following happens:

        // 1. The Order's initial state is '0' (Open) which can be displayed as 'Pending' in apps,
        // because the Freelancer has not yet confirmed the Order fulfillment

        // 2. If the Freelancer confirms the Order by adding the 'a' tag of this Order to its Service,
        // the Order is still Open but apps can change displayed status to 'In Fulfillment'

        // 3. The Order is closed by the Client paying and posting a Review. This concludes the Order
        // with a '1' (Fulfilled) state or a '2' (Failed) state. Orders with Fulfilled and Failed states
        // can be displayed as 'Closed' in apps that want to gather cocluded Orders together.

        [ "s", <'0' (Open) OR '1' (Fulfilled) OR '2' (Failed)> ],

        // Pricing Strategy at the time order was placed (Absolute or Time-based). Mandatory
        ["pricing", <'0'(sats) | '1'(sats/minute)>],

        // Price of service at the time order was placed. Refers to the absolute price OR sats/minute. Mandatory
        ["amount", <100>]

        // This tag MUST be set on creation of this event. Points to the
        // Freelance Service that the Client wants to order. Mandatory
        ["a", "32765:<hex pubkey of Freelancer>:<Freelance Service d-tag>"],
    ],
    "content": {
        <A Note for the Freelancer selling the Service. Optional>
    }
}

```

### Freelance Job event (Posted by Client)

```json
{
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

        // Job status. "New" while Job is taking Bids, "In-Progress" as soon as a Bid is taken, and "Resolved/Failed" when the Job is concluded
        [ "s", <'0' (New) OR '1' (In Progress) OR '2' (Resolved) OR '3' (Failed)> ],

        // If Client accepts a Freelance Bid he SHOULD set this tag
        ["a", "32768:<hex pubkey of Freelancer>:<Freelance Bid d-tag>"],
    ],
    "content": {
        <detailed description of the Job, mandatory>
    }
}
```

### Freelance Bid (Posted by the Freelancer on a specific Job)

```json
{
    "kind": 32768,
    "tags": [
        // Replacement is based on this. Allows for multiple Bids with simple edits. Mandatory
        ["d", "<Bid ID>"],

        // Pricing Strategy: Absolute or Time-based. Mandatory
        ["pricing", <'0'(sats) | '1'(sats/minute)>],

        // Price of bid. Refers to the absolute price OR sats/minute. Mandatory
        ["amount", <500>]

        Freelancer MUST set this tag when bidding on a Job. Mandatory
        ["a", "32767:<hex pubkey of Client>:<Job d-tag of a Job>">],

        // Tag if Freelancer wants to share public payments (zaps) on this Service
        // These can be percentage ratios adding up to 100%. Optional
        ["zap", "<Freelancer pubkey>", "<relay hint>", "95"]
        ["zap", "<Supported pubkey (e.g. app dev)>", "<relay hint>", "5"]
    ],
    "content": {
        <Pitch explaining why Freelancer is the right fit for the Job. Optional>,
    }
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
    "kind": 1986,
    "tags": [
        // ALL tags are mandatory
        ["L", qts/freelancing]
        ["l", “freelancer”, “qts/freelancing”],
        ["rating", “<0 | 0.5>”, “success”],
        ["rating", “<0 | 0.3>”, “expertise”],
        ["rating", “<0 | 0.2>”, “communication”],
        ["a", "<32765 | 32768>:<hex pubkey of Freelancer>:<Service/Bid d-tag>"],
    ],
    "content": {
        <Short summary of the experience. Optional>
    },
}
```

### Client Review event (posted by Freelancer)

```json
{
    "kind": 1986,
    "tags": [
        // ALL tags are mandatory
        ["L", qts/freelancing]
        ["l", “client”, “qts/freelancing”],
        ["rating", “<0 | 0.5>”, “thumb”],
        ["rating", “<0 | 0.5>”, “communication”],
        ["a", "<32766 | 32767>:<hex pubkey of the Client>:<Order/Job d-tag>"],
    ],
    "content": {
        <Short summary of the experience. Optional>
    },
}
```
