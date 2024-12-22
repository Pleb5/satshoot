# SatShoot
A freelance app for freedom-lovers, using nostr

Try it live on:
```
https://satshoot.com
```

## Benefits
- No middle-man: Your nostr keys, your contacts, your deals
- Your servers: Respects your relays of choice (see [outbox model](https://nostr-nips.com/nip-65))
- Web of Trust(WoT): Uses Your nostr-based social network to fight scammers and spammers
    - For bootstrapping visibility, the apps Web of Trust is attached by default to the user's WoT
    - This can be swithed off
- Build an unstoppable Reputation on nostr as a freelancer
- Public Payments(zaps) with Lightning or with the built-in [nostr-native](https://nips.nostr.com/60) [Cashu](https://cashu.space/) ecash wallet
- Reviews based on QTS system, specs [here](https://github.com/Pleb5/satshoot/blob/main/apps/satshoot/EVENT_STRUCTURE.md#review-events)

## Typical Flow
- Clients post any job or problem. This is basically a Request For Quote (RFQ)
- Freelancers bid on Jobs with Offers to resolve the problem for sats. It can be an absolute or a time-based price
- Clients select the most attractive Offer: Price and Reputation of the bidder matter most
- If an Offer is accepted problem solving can begin via any means of communication, defaulting to nostr DM-s (nip04, soon [nip17](https://nips.nostr.com/17))
- You can pay any time after agreement and review each other
- You build Reputation by earning / paying for services with public zaps on nostr and by receiving public reviews
- You can post on your nostr feed to share Jobs and promote your services

- Built with [Nostr Development Kit](https://github.com/nostr-dev-kit/ndk) by @[pablof7z](https://github.com/pablof7z)
