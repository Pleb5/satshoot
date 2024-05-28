# bitcoin-troubleshoot
An app for bitcoiners to troubleshoot each other's technical issues for sats, using nostr

Try it live on:
```
https://bitcointroubleshoot.com
```

## ------ ! Work In Progress ! ------

# The short story:

- Bitcoiners will be able to post tickets about technical issues they have
- Other Bitcoiners[Troubleshooters] will send offers to resolve the problem for sats
- Bitcoiners pay for troubleshooting based on an agreed fee. An absolute or a time-based price can be set on Offers
- If an offer is accepted, troubleshooting can begin via any means of communication, defaulting to nostr DM-s

- Built with [Nostr Development Kit](https://github.com/nostr-dev-kit/ndk) by @[pablof7z](https://github.com/pablof7z)

---

# The Long story:

# Bitcoin Troubleshoot
The "decentralized customer support network" of bitcoin.

# Sources and inspiration
- Stacker news
- Stack exchanges(bitcoin stack exchange, stackoverflow)
- Centralized Freelancer platforms(Fiverr, Upwork)
- Decentralized marketplaces(joinmarket, bisq, robosats)

# Motivation
Bitcoins heavily favors self custody. Total user control over a digital bearer asset.

Bitcoin self custody however requires the holder to understand how bitcoin works in order to do it in a private and secure way. People need education to select the solutions that suit their needs. They also need to train to use their bitcoin hardware and software stack confidently.

Despite all this learning and training, people still often need assistance in the form of troubleshooting and consultation. The options Bitcoiners have today are:
- Learn everything by themselves. Hard to do.
- Friends in the know
- Companies
- Chat groups and forums
- AI

In spite of the number of Bitcoiners increasing every year, it is still hard to find a trusty friend who is willing to help the Bitcoiner. Even if there is one, they often lack the time to help.

Fiat companies alone cannot fulfill this role because of government compliance risk. Privacy is basically impossible. Surveillance capitalism often leads to exploitation of customers. Lots of companies have hidden motives to spread FUD about projects that jeopardize their profits and make their clients helpless by locking them in their proprietary solutions.

There is also volunteer help in different chat groups such as Telegram and Discord. These groups are filled with scammers and there are numerous scam groups lurking on newbie Bitcoiners trying to learn.
 Additionally, Telegram and other messaging apps are not properly decentralized and the user-experience is not customized to the troubleshooting use-case.

AI is coming up as a good way to troubleshoot technical issues but even the most advanced AI solutions need heavy human supervision. Their word can absolutely not be taken as a source of truth.
Moreover, cloud-based AI exposes serious privacy and security risks if not used with caution. Despite all that, self-hosted AI is very rare yet even among tech-savvy bitcoiners.

Bitcoiners need a decentralized and effective way to troubleshoot their bitcoin related problems and get help from people deeper down the rabbit hole.

# The Solution

I think that like many other problems in bitcoin, this is also solvable by free market incentives:

**A P2P marketplace for solving problems related to bitcoin self-custody, using bitcoin and nostr: Bitcoin Troubleshoot app, the decentralized customer support network of bitcoin**

## Roles
1. Bitcoiners: Hodlers with issues or questions, willing to pay sats for help
2. Troubleshooters: People offering their time and expertise to resolve hardware and software related problems of Bitcoiners

- Bitcoiners get timely help in stressful situations when every minute counts and stakes are high. They might also get up-to-date advice on their hatdware and software stack.

- Troubleshooters collect sats as a reward. My experience is that self-custody related problems can often generate great frustration and anxiety.
My guess is that Bitcoiners would gladly pay tens of thousands if not hundreds of thousands of sats to get their issue sorted out.

# Design
Most important aspects to address in the design:
- Very strong focus on self-custody support: We don't need another general IT support or social app/community forum.
- Censorship: the app would involve bitcoin payments so censorship-resistance is a must
- Security and privacy: Self-Custody is a sensitive topic, funds and user-identities are at stake especially for vulnerable newbies
- UX:
    - For the Bitcoiner we need to create a relatively safe environment where he can get help quickly and pay without much hassle
    - For the Troubleshooters we need to make their time worthwhile to motivate many quality experts to join. It could be a side hustle or a full-time engagement for them
    - We need good incentives to protect against bad hehavior to facilitate trust between Bitcoiners and Troubleshooters


## Troubleshooting process
The hard part is that bitcoin self-custody is a highly sensitive issue. There is a risk of devastating loss for the Bitcoiner. Bad actors could trick newbies out of their coins.

On the other side of this deal, the troubleshooter ideally needs some kind of proof that the Bitcoiner will indeed pay up.

The troubleshoot process needs to reflect this reality. A rough overview of how this would work:

1. Bitcoiner creates a guided issue description with title, body and tags like "Wallet Software", "Sparrow", "Bluewallet", "Node", "Raspiblitz", "RoninDojo", "Tor", "VPN", "Hardware wallet", "Seedsigner", "Coldcard", etc.(like on forums)
2. Bitcoiner posts the ticket on nostr and waits for proposals from Troubleshooters or finds one and sends him the ticket request directly
    1. Troubleshooters can advertise availabilty and fields of expertise by setting up their profiles. The more professional the profile the more ticket requests from Bitcoiners
3. Troubleshooter filters new tickets for his expertise and finds the post of the Bitcoiner. He checks the Bitcoiner's profile which might be an ephemeral, fresh profile but can also be a persistent, ordinary one. If someone trades off privacy for reputation he can show stats about his track record in the Bitcoiner role
4. The Troubleshooter makes a proposal to solve the ticket:
    1. Sats/minute or absolute amount of sats. Fees are billed manually by the Troubleshooter and paid manually by the Bitcoiner. Automatic payments are too error-prone and would need a lot of heavy-lifting to be implemented safely. The assumption is that the Troubleshooter will watch out for himself not to work for free, while the Bitcoiner is never charged accidentally
    3. Optional cover letter about how he would go about the problem or why he would be a good choice
5. The Bitcoiner can wait some time to get multiple possible proposals. He checks the profile of the Troubleshooters. A Troubleshooter with a persistent profile could earn reputation by showcasing his earnings, reviews and some other stats related to his Troubleshooting track record. He has a strong incentive to do that in order to win the job
6. Once the discovery has been made, the Bitcoiner and the Troubleshooter can engage in encrypted direct messages to further discuss the context of the job
7. The Bitcoiner takes one of the proposals and other competing Troubleshooters are notified of this
8. The Troubleshooter who won the job is alerted and has to start resolving the issue
    1. The issue gets resolved in encrypted DM or elsewhere if negotiated
    2. The Troubleshooter submits payment requests according to the accepted proposal. Bitcoiner pays the invoices.
    3. It might be the case that the Troubleshooting fails. The ticket cannot be resolved by the Troubleshooter or either party is unresponsive. Sats cannot be refunded that are already paid but there will be no further payments made by the Bitcoiner, nor will the Troubleshooter keep working for free
    4. The Bitcoiner open a new identical ticket giving up on that Troubleshooter
9. The parties can leave public reviews on the experience. "5-star" reviews with praising words can go a long way to win new proposals or to attract high quality proposals, especially if these reviews come from reputable people.

## More on Reputation
In reality in a decentralized open-source system there is no sure-fire way to create a reliable reputation metric. One could spawn modded clients or multiple users and spam events that either raise his own reputation or damages other's. Even zaps can be faked when someone zaps himself for higher scores.

Other bitcoin related measures can be used such as fidelity bonds used in Joinmarket with proveable timelocked transactions. Another approach is using your own Lightning node as a source of truth for zap-based reputation. Yet another approach would be to check a nostr profile for other nostr related activity, orthogonal to Bitcoin Troubleshoot if that profile is used for multiple purposes in the nostr ecosystem.

One might think of many metrics that could be used for reputation scoring, and nostr is a great protocol to build decentralized reputation systems, but this might be out of scope for Bitcoin Troubleshoot per se. No need to tackle everything at once.

## Trust model between the parties
We can say  that the biggest threat is for a Bitcoiner to be scammed. We can introduce onboarding steps to teach the Bitcoiner how to avoid being scammed or guide him to such tutorials. The app can also hint the user to check for signs of trustworthiness i.e. reviews and money collected. One could also use a scam detection AI software that alerts on potentially scammy behavior.

From the Troubleshooter's perspective, there is a risk of not getting paid for some work done in advance, but payments are instant and there is no chargeback risk or middleman involved unlike on classic fiat freelancer platforms.

Reputation signals will help parties trust each other but other than that anyone can just ghost the other one in a session, realistically speaking. If the Bitcoiner does not pay, the Troubleshooter does not help any further. If the Troubleshooter is not responsive, the Bitcoiner stops paying.

Nostr allows for users to also mute and hide each other so they will never meet again on the marketplace but there is no way to block others from seeing reviews left on a ticket.

# Architecture
The "orderbook" lives on nostr relays. Bitcoiners and Troubleshooters run the same nostr client which only listens to the necessary events regarding the service.

## Nostr
Discovery, contract negotiation and execution is solved with nostr. Communication specifically can be solved with nostr or other tools. The best would be to define or extend a NIP for this of use-case but right now it is enough to just start with app-specific event kinds and create a **dedicated open-source client** for the best user-experience.

Nostr solves many problems at the same time:
1. Don't need to bootstrap the backend infrastructure
2. The nostr architecture makes apps fairly Censorship resistant
3. Nostr has already drawn the attention of bitcoiners: Less friction when onboarding users, easier promotion of the app
4. Nostr has a strong bitcoin integration already
5. There are many open-source nostr clients and NDK. Easy to start building
6. Nostr accounts are permissionless: They don't depend on the client nor the relays to use the service
7. Nostr is great for reputation scoring, for a decentralized protocol at least. This makes room for innovation on the web-of-trust front.
8. As for the custom client, a simple website or a Progressive Web App seems like a good solution:
    1. Apps can be censored on app stores, side-loading is not always possible and introduces much friction
    2. PWA is Cross-platform and can have a nice native-like UI on all platforms. Bitcoiners interact with their self-custody setups mostly on desktops but the mobile experience allows for troubleshooters to work from anywhere.     
    3. Easy to integrate with Alby, Mutiny and other LN wallets supporting nostr wallet connect
    4. The biggest downside of this approach is the fact that a browser will never be as secure to store private key material as most other solutions
9. Being a flexible protocol used for all kinds of social use-cases, nostr allows for further features in the future, built on activity from Bitcoin Troubleshooting 
### Relays
Once the nostr event kinds are defined, the users just subscribe to those event kinds and connect to their preferred relays. There can be some dedicated relays handling only these kinds that are necessary to Bitcoin Troubleshoot as defaults.

### Handled events
- NIP07 or NIP46 for event signing("login"). The app will not create, nor store a nostr private key. Guides can help the user set these up
- New event kinds for posting tickets and making proposals. NIP99("Classified listings") could be an inspiration for these
- The contract negotiation and the Troubleshooting itself will make use of the NIP44 encrypted DMs if not negotiated otherwise(nostr could be just the contracting layer and comms could be taken to e.g. SimpleX)
- The app must be able to handle zap and wallet connect event kinds(NIP57 and NIP47) for payments
- Example nips to implement some reputation algorithm: NIP32(reviews), NIP51(mute list, blocked relays), NIP56(reports using spam or impersonation)

### Ticket states
On nostr a ticket state is a parameterized replaceable event
- "New": Newly posted ticket with no proposals accepted yet
- "In Progress": Bitcoiner took an offer and the Ticket is being resolved by the parties
- "Closed": The Bitcoiner had his issue resolved OR the resolution process failed
- Only "New" tickets are of interest to Troubleshooters

## Payments
Practically any method could be negotiated between parties. LN payments will most likely be the choice for most. Base-layer transactions are too slow and lack privacy. 

There could be many extra features developed in the future that help facilitate contract execution between parties e.g. a time logger that is controlled by the Troubleshooter and can be monitored by the Bitcoiner.

----

**In a nutshell, I think Bitcoin Troubleshoot would take a much-needed niche among the bitcoin self-custody assistance solutions, thanks to the nature of nostr and the irreversible, fast and cheap payments of the Lightning Network.**
