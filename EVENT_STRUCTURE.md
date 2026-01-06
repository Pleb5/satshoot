# Freelance-related events used in SatShoot

## Freelance Events: Orders on a Service (Many-to-One) and Bids on a Job (Many-to-One)

### Freelance Service event (Posted by Freelancers)

```json
{
    "kind": 32765,
    "tags": [
        // Update/Replacement is based on this. Allows for multiple Services with simple edits. Mandatory
        ["d", "<Service ID>"],

        ["published_at", <timestamp>], // this is actual publish date

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
        ["pricing", <'0'(sats) | '1'(sats/hour)>],

        // Price of service. Refers to the absolute price OR sats/hour. Mandatory
        ["amount", <100>]

        // Status. Deactivation indicates that this Service is not offered anymore
        // while preserves its history. Mandatory
        [ "s", <'0' (Inactive) OR '1' (Active)> ],

        // Records all status changes. Append new entries, never replace existing ones
        // for initial state use -1 for from_status
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        // ... more state history entries as status changes occur

        // Records all pricing changes (amount and pricing). Append new entries, never replace existing ones
        ["pricing_history", JSON.stringify(old_amount_pricing), JSON.stringify(old_amount_pricing), <change_timestamp>],
        ["pricing_history", JSON.stringify(old_amount_pricing), JSON.stringify(old_amount_pricing), <change_timestamp>],
        // ... more pricing history entries as pricing changes occur

        // If a Freelancer is ready to fulfill a Freelance Order, they SHOULD set this.
        // Multiple a-tags mean that this Service has been sold multiple times
        ["a", "32766:<hex pubkey of Client1>:<Freelance Order d-tag>", <acceptance_timestamp>],
        ["a", "32766:<hex pubkey of Client2>:<Freelance Order d-tag>", <acceptance_timestamp>],

        // Tag if Freelancer wants to share public payments (zaps) on this Service
        // These can be percentage ratios adding up to 100%. Optional
        ["zap", "<Freelancer pubkey>", "<relay hint>", "96"]
        ["zap", "<Supported pubkey (e.g. app dev)>", "<relay hint>", "2"]
        ["zap", "<Sponsored pubkey (optional e.g. partner of the freelancer)>", "<relay hint>", "2"]
        ["zap_history", JSON.stringify(old_state), JSON.stringify(new_state)]
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

        ["published_at", <timestamp>], // this is actual publish date

        // Mandatory. Clients place an Order on a Service and the following happens:

        // 1. The Order's initial state is '0' (Open) which can be displayed as 'Pending' in apps,
        // because the Freelancer has not yet confirmed the Order fulfillment

        // 2. If the Freelancer confirms the Order by adding the 'a' tag of this Order to its Service,
        // the Order is still Open but apps can change displayed status to 'In Fulfillment'

        // 3. The Order is closed by the Client paying and posting a Review. This concludes the Order
        // with a '1' (Fulfilled) state or a '2' (Failed) state. Orders with Fulfilled and Failed states
        // can be displayed as 'Closed' in apps that want to gather concluded Orders together.

        [ "s", <'0' (Open) OR '1' (Fulfilled) OR '2' (Failed)> ],

        // Records all status changes. Append new entries, never replace existing ones
        // for initial state use -1 for from_status
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        // ... more state history entries as status changes occur



        // Pricing Strategy at the time order was placed (Absolute or Time-based). Mandatory
        ["pricing", <'0'(sats) | '1'(sats/hour)>],

        // Price of service at the time order was placed. Refers to the absolute price OR sats/hour. Mandatory
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

        ["published_at", <timestamp>], // this is actual publish date

        // Category Labels, max 5 recommended. Optional
        ["t", "<tag1>"],
        ["t", "<tag2>"],
                ...
        ["t", "<tagN>"],

        // Job status. "New" while Job is taking Bids, "In-Progress" as soon as a Bid is taken, and "Resolved/Failed" when the Job is concluded
        [ "s", <'0' (New) OR '1' (In Progress) OR '2' (Resolved) OR '3' (Failed)> ],

        // Records all status changes. Append new entries, never replace existing ones
        // for initial state use -1 for from_status
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        ["state_history", <from_status>, <to_status>, <change_timestamp>],
        // ... more state history entries as status changes occur


        // If Client accepts a Freelance Bid he SHOULD set this tag
        ["a", "32768:<hex pubkey of Freelancer>:<Freelance Bid d-tag>", <acceptance_timestamp>],
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

        ["published_at", <timestamp>], // this is actual publish date

        // Pricing Strategy: Absolute or Time-based. Mandatory
        ["pricing", <'0'(sats) | '1'(sats/hour)>],

        // Price of bid. Refers to the absolute price OR sats/hour. Mandatory
        ["amount", <500>]

        // Records all pricing changes (amount and pricing). Append new entries, never replace existing ones
        ["pricing_history", JSON.stringify(old_amount_pricing), JSON.stringify(old_amount_pricing), <change_timestamp>],
        ["pricing_history", JSON.stringify(old_amount_pricing), JSON.stringify(old_amount_pricing), <change_timestamp>],
        // ... more pricing history entries as pricing changes occur

        // Freelancer MUST set this tag when bidding on a Job. Mandatory
        ["a", "32767:<hex pubkey of Client>:<Job d-tag of a Job>">],

        // Tag if Freelancer wants to share public payments (zaps) on this Bid
        // These can be percentage ratios adding up to 100%. Optional
        ["zap", "<Freelancer pubkey>", "<relay hint>", "96"]
        ["zap", "<Supported pubkey (e.g. app dev)>", "<relay hint>", "2"]
        ["zap", "<Sponsored pubkey (optional e.g. partner of the freelancer)>", "<relay hint>", "2"]
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
Most of the score is determined by the overall outcome or experience with the counterparty,
and excellence labels make up the other half of the score. This allows for labels
to contribute to the overall rating consensus while this also allows for distinguishing
Clients and Freelancers by their outstanding attributes.

While the is a good framework to use, there can be opinionated implementations of this system.
Nostr apps can determine the exact labels and the weights of the "excellence labels",
therefore in SatShoot we have either '0' or '1' as a value in the rating tags,
which showcases all the possible labels in each event, while only indicating if
the reviewed freelancer or client received that label or not, the exact scoring itself is
left to the implementation to decide.

Important to note that if the overall experience is bad (success/thumb), every other label SHOULD be 0

The scores in SatShoot are commented out.

### Freelancer Review event (posted by Client)

```json
{
    "kind": 1986,
    "tags": [
        // ALL tags are mandatory
        ["L", qts/freelancing]
        ["l", “freelancer”, “qts/freelancing”],
        // worth 0.5 in satshoot
        ["rating", “<0 | 1>”, “success”],
        // worth 0.3 in satshoot
        ["rating", “<0 | 1>”, “expertise”],
        // worth 0.2 in satshoot
        ["rating", “<0 | 1>”, “communication”],
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
        // worth 0.5 in satshoot
        ["rating", “<0 | 1>”, “thumb”],
        // worth 0.5 in satshoot
        ["rating", “<0 | 1>”, “communication”],
        ["a", "<32766 | 32767>:<hex pubkey of the Client>:<Order/Job d-tag>"],
    ],
    "content": {
        <Short summary of the experience. Optional>
    },
}
```
