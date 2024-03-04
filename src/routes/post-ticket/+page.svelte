<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { NDKRelaySet } from '@nostr-dev-kit/ndk';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';

    import pageTitleStore from "$lib/stores/pagetitle-store";

    import { InputChip } from '@skeletonlabs/skeleton';
    import { Autocomplete } from '@skeletonlabs/skeleton';
    import type { AutocompleteOption } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';

    // Retrieve Toast store at the top level
    const toastStore = getToastStore();

    // Retrieve Modal Store at the top level
    const modalStore = getModalStore();
			
    $pageTitleStore = 'Post Ticket';

    let tagInput = '';
    
const tagOptions: AutocompleteOption<string>[] = [
        // Hardware wallets and other hardware
        { label: 'SeedSigner', value: 'seedsigner'},
        { label: 'Coldcard', value: 'coldcard'},
        { label: 'Foundation Passport', value: 'foundation_passport'},
        { label: 'Blockstream Jade', value: 'blockstream_jade'},
        { label: 'SpecterDIY', value: 'specterdiy'},
        { label: 'Ledger', value: 'ledger'},
        { label: 'Trezor', value: 'trezor'},
        { label: 'Bitbox', value: 'bitbox'},
        { label: 'Cobo Vault', value: 'cobo_vault'},
        { label: 'Keep key', value: 'keep_key'},
        { label: 'Block Clock', value: 'block_clock'},
        { label: 'Opendime', value: 'opendime'},
        { label: 'SatsCard', value: 'satscard'},
        { label: 'TapSigner', value: 'tapsigner'},
        { label: 'SatChip', value: 'satchip'},
        { label: 'ColdPower', value: 'coldpower'},
        { label: 'ESP32', value: 'esp_32'},
        { label: 'STM32', value: 'stm_32'},
        { label: 'SeedQR', value: 'seed_qr'},
        { label: 'SeedHammer', value: 'seed_hammer'},
        { label: 'SeedMint', value: 'seed_mint'},
        { label: 'NerdMiner', value: 'nerd_miner'},
        { label: 'SatsLink', value: 'satslink'},

        // Wallet software
        { label: 'Sparrow Wallet', value: 'sparrow'},
        { label: 'Nunchuk', value: 'nunchuk'},
        { label: 'Electrum', value: 'electrum'},
        { label: 'Specter Desktop', value: 'specter_desktop'},
        { label: 'Lily wallet', value: 'lily_wallet'},
        { label: 'Samourai Wallet', value: 'samourai'},
        { label: 'Blue Wallet', value: 'blue_wallet'},
        { label: 'Blockstream Green', value: 'blockstream_green'},
        { label: 'Envoy', value: 'envoy'},
        { label: 'Bitcoin Keeper', value: 'bitcoin_keeper'},
        { label: 'Hexa', value: 'hexa'},
        { label: 'Caravan', value: 'caravan'},
        { label: 'Muun wallet', value: 'muun'},
        { label: 'Phoenix', value: 'phoenix'},
        { label: 'Breez', value: 'breez'},
        { label: 'Blixt', value: 'blixt'},
        { label: 'Mutiny wallet', value: 'mutiny'},
        { label: 'Simple Bitcoin Wallet', value: 'simple_bitcoin_wallet'},
        { label: 'Valet', value: 'valet'},
        { label: 'BitKit', value: 'bitkit'},
        { label: 'Nayuta', value: 'nayuta'},
        { label: 'Alby', value: 'alby'},
        { label: 'Zeus', value: 'zeus'},
        { label: 'Strike', value: 'strike'},
        { label: 'Wallet of Satoshi', value: 'wos'},
        { label: 'CoinOS', value: 'coinos'},
        { label: 'LNTipBot', value: 'ln_tip_bot'},
        { label: 'Plasma', value: 'plasma'},
        { label: 'Blink', value: 'blink'},
        { label: 'Chivo', value: 'chivo'},
        { label: 'CashApp', value: 'cashapp'},
        { label: 'Zebedee', value: 'zebedee'},
        { label: 'BitBanana', value: 'bitbanana'},
        { label: 'Spark', value: 'spark'},
        { label: 'Fully Noded', value: 'fully_noded'},
        { label: 'Thunderhub', value: 'thunderhub'},
        { label: 'Ride The Lightning', value: 'rtl'},
        { label: 'Clams', value: 'clams'},
        { label: 'LNBits', value: 'lnbits'},
        { label: 'Liana', value: 'liana'},
        { label: 'Walletano', value: 'walletano'},
        { label: 'LifPay', value: 'lifpay'},
        { label: 'Wasabi wallet', value: 'wasabi'},
        { label: 'eNuts wallet', value: 'enuts_wallet'},
        { label: 'Minibits eCash wallet', value: 'minibits_wallet'},
        { label: 'Nutstash wallet', value: 'nutstash_wallet'},
        { label: 'Mercury wallet', value: 'mercury_wallet'},
        { label: 'MyCitadel wallet', value: 'mycitadel_wallet'},

        // Node implementations
        { label: 'Bitcoin Core', value: 'bitcoin_core'},
        { label: 'Bitcoin Knots', value: 'bitcoin_knots'},
        { label: 'LND', value: 'lnd'},
        { label: 'Core Lightning', value: 'clightning'},
        { label: 'Eclair', value: 'eclair'},

        // Node boxes and packages
        { label: 'Nix Bitcoin', value: 'nix_bitcoin'},
        { label: 'RaspiBlitz', value: 'raspiblitz'},
        { label: 'Ministry of Nodes', value: 'ministry_of_nodes'},
        { label: 'RoninDojo', value: 'ronindojo'},
        { label: 'Nodl', value: 'nodl'},
        { label: 'Raspibolt', value: 'raspibolt'},
        { label: 'MiniBolt', value: 'minibolt'},
        { label: 'Umbrel', value: 'umbrel'},
        { label: 'Thundroid', value: 'thundroid'},
        { label: 'Start9', value: 'start9'},
        { label: 'MyNode', value: 'my_node'},
        { label: 'Citadel', value: 'citadel'},
        { label: 'Floresta', value: 'floresta'},

        // Other software
        { label: 'Bitcoin-CLI', value: 'bitcoin_cli'},
        { label: 'Bitcoind', value: 'bitcoind'},
        { label: 'Electrum Rust Server', value: 'electrs'},
        { label: 'Fulcrum Server', value: 'fulcrum'},
        { label: 'BTC PayServer', value: 'btc_payserver'},
        { label: 'WhirlPool', value: 'whirlpool'},
        { label: 'JoinMarket', value: 'joinmarket'},
        { label: 'JoininBox', value: 'joinmarket_joininbox'},
        { label: 'JAM', value: 'joinmarket_jam'},
        { label: 'Samourai Dojo', value: 'samourai_dojo'},
        { label: 'Sentinel', value: 'sentinel'},
        { label: 'Sphinx', value: 'sphinx'},
        { label: 'Balance of Satoshis', value: 'lnd_bos'},
        { label: 'LND Helipad', value: 'lnd_helipad'},
        { label: 'LND Channel Tools', value: 'lnd_chan_tools'},
        { label: 'LND Tallycoin', value: 'lnd_tallycoin'},
        { label: 'Homer Dashboard', value: 'homer_dashboard'},
        { label: 'LNProxy Server', value: 'lnproxy_server'},
        { label: 'LND PyBlock', value: 'lnd_pyblock'},
        { label: 'ItchySats', value: 'itchysats'},
        { label: 'Mempool.space', value: 'mempool_space'},
        { label: 'BTC RPC Explorer', value: 'btc_rpc_explorer'},
        { label: 'Amboss', value: 'amboss'},
        { label: 'OXT.me', value: 'oxt'},
        { label: 'CKBunker', value: 'ckbunker'},
        { label: 'Unchained', value: 'unchained'},
        { label: 'Zaprite', value: 'zaprite'},
        { label: 'LND Lightning Terminal', value: 'lnd_lit'},
        { label: 'Lightning Loop', value: 'loop'},
        { label: 'Lightning Pool', value: 'pool'},
        { label: 'Lightning Faraday', value: 'faraday'},
        { label: 'Magma', value: 'magma'},
        { label: 'KeePass', value: 'keepass'},
        { label: 'Bitwarden', value: 'bitwarden'},
        { label: 'Proton VPN', value: 'proton_vpn'},
        { label: 'iVPN', value: 'ivpn'},
        { label: 'Mullvad VPN', value: 'mullvad_vpn'},
        { label: 'GrapeneOS', value: 'graphene_os'},
        { label: 'CopperheadOS', value: 'copperhead_os'},
        { label: 'CalyxOS', value: 'calyx_os'},
        { label: 'Qubes OS', value: 'qubes_os'},
        { label: 'Tails OS', value: 'tails_os'},
        { label: 'SimpleX', value: 'simplex'},
        { label: 'Voltage', value: 'voltage'},
        { label: 'Nostr Zaps', value: 'nostr_zaps'},
        { label: 'Fedimint', value: 'fedimint'},
        { label: 'Cashu', value: 'cashu'},
        { label: 'Shopstr', value: 'shopstr'},
        { label: 'Geyser.fund', value: 'geyser'},
        { label: 'Fountain', value: 'fountain'},
        { label: 'ShopinBit', value: 'shopinbit'},
        { label: 'Stacker.news', value: 'stacker_news'},
        { label: 'Oshi', value: 'oshi'},
        { label: 'Lolli', value: 'lolli'},
        { label: 'BTC Map', value: 'btc_map'},
        { label: 'Blockstream GreenLight', value: 'blockstream_greenlight'},
        { label: 'Liquid network', value: 'liquid'},
        { label: 'BitStream', value: 'bitstream'},
        { label: 'BitVM', value: 'bitvm'},
        { label: 'HORNET storage', value: 'hornet_storage'},
        { label: 'LNeSIM', value: 'ln_esim'},
        { label: 'RGB', value: 'rgb'},
        { label: 'Zaplocker', value: 'zaplocker'},
        { label: 'Bitrefill', value: 'bitrefill'},
        { label: 'Zapple Pay', value: 'zapple_pay'},
        { label: 'Bolt.observer', value: 'bolt_observer'},

        // Exchanges, financial services
        { label: 'Bisq', value: 'bisq'},
        { label: 'HodlHodl', value: 'hodlhodl'},
        { label: 'Robosats', value: 'robosats'},
        { label: 'Peach Bitcoin', value: 'peach'},
        { label: 'AgoraDesk', value: 'agora_desk'},
        { label: 'Pocket', value: 'pocket'},
        { label: 'Azte.co', value: 'azteco'},
        { label: 'Bitcoin Reserve', value: 'bitcoin_reserve'},
        { label: 'Bitkipi', value: 'bitkipi'},
        { label: 'Bitonic', value: 'bitonic'},
        { label: 'Bittr', value: 'bittr'},
        { label: 'BullBitcoin', value: 'bullbitcoin'},
        { label: 'FastBitcoins', value: 'fastbitcoins'},
        { label: 'Relai', value: 'relai'},
        { label: 'River', value: 'river'},
        { label: 'Swan Bitcoin', value: 'swan_bitcoin'},
        { label: 'Loan Shark', value: 'loan_shark'},
        { label: 'Firefish.io', value: 'firefish_io'},
        { label: 'Vexl.it', value: 'vexl'},
        { label: 'Coinbase', value: 'coinbase'},
        { label: 'Kraken', value: 'kraken'},
        { label: 'Bitstamp', value: 'bitstamp'},
        { label: 'OKCoin', value: 'okcoin'},
        { label: 'Binance', value: 'binance'},
        { label: 'Bitfinex', value: 'bitfinex'},
        { label: 'Gemini', value: 'gemini'},
        { label: 'Boltz Exchange', value: 'boltz_exchange'},
        { label: 'Resolvr', value: 'resolvr'},
        { label: 'BitEscrow', value: 'bit_escrow'},
        { label: 'Torq', value: 'torq'},

        // Mining
        { label: 'Home mining', value: 'home_mining'},
        { label: 'Braains', value: 'braiins'},
        { label: 'Mining Pools', value: 'mining_pools'},
        { label: 'OCEAN Pool', value: 'ocean_pool'},
        { label: 'F2Pool', value: 'f2pool'},
        { label: 'AntPool', value: 'antpool'},
        { label: 'Luxor', value: 'luxor'},
        { label: 'ProHashing', value: 'pro_hashing'},
        { label: 'Mining-Dutch', value: 'mining_dutch'},
        { label: 'Mining Pool Hub', value: 'mining_pool_hub'},
        { label: 'Blockware Pools', value: 'blockware_pools'},
        { label: 'BTC Pool', value: 'btc_pool'},
        { label: 'BTC Mill', value: 'btc_mill'},
        { label: 'Cruxpool', value: 'crux_pool'},
        { label: 'Dpool', value: 'd_pool'},
        { label: 'EMCD Pool', value: 'emcd_pool'},
        { label: 'Fire Pool', value: 'fire_pool'},
        { label: 'Bitaxe', value: 'bitaxe'},
        { label: 'FutureBit Apollo', value: 'futurebit_apollo'},
        { label: 'Cathedra OS', value: 'cathedra_os'},
        { label: 'Bitmain', value: 'bitmain'},
        { label: 'Antminer', value: 'antminer'},

        // Other helpful keywords related to bitcoin
        { label: 'Wallet Software', value: 'wallet_software'},
        { label: 'Node', value: 'node'},
        { label: 'Lightning', value: 'lightning'},
        { label: 'Hardware wallet', value: 'hardware_wallet'},
        { label: 'Coinjoin', value: 'coinjoin'},
        { label: 'PayJoin', value: 'payjoin'},
        { label: 'PayNym', value: 'paynym'},
        { label: 'StoneWall', value: 'stonewall'},
        { label: 'Coin Control', value: 'coin_control'},
        { label: 'UTXO', value: 'utxo'},
        { label: 'UTXO Management', value: 'utxo_management'},
        { label: 'Tor', value: 'tor'},
        { label: 'Multisig wallets', value: 'multisig'},
        { label: 'Singlesig wallets', value: 'singlesig'},
        { label: 'SegWit', value: 'segwit'},
        { label: 'Taproot', value: 'taproot'},
        { label: 'Seed Phrase', value: 'seed_phrase'},
        { label: 'Desktop', value: 'desktop'},
        { label: 'Mobile', value: 'mobile'},
        { label: 'Lightning Dev Kit', value: 'ldk'},
        { label: 'Bitcoin Dev Kit', value: 'bdk'},
        { label: 'Lightning Service Provider', value: 'lsp'},
        { label: 'ZeroSync', value: 'zerosync'},
        { label: 'UTreexo', value: 'utreexo'},
        { label: 'Bitcoin ATM', value: 'bitcoin_atm'},
        { label: 'LN URL', value: 'ln_url'},
        { label: 'VPN', value: 'vpn'},
];
				

    let tagList: string[] = [];

    // For form validation
    const maxTags:number = 5;
    const minDescriptionLength = 20;
    const minTitleLength = 10;

    // For form submission
    let titleValid = false;
    let descriptionValid = false;
    // reactive values bound to user input
    let titleText: string='';
    let descriptionText: string='';
    // reactive classes based on validity of user input
    let titleState = '';
    let descriptionState = '';

    // Tag validation on tag selection from autocomplete
    function onTagSelection(event: CustomEvent<AutocompleteOption<string>>): void {
        let tagValue = event.detail.value;
        // Run validation checks here(dont allow duplicates, max=5 tags) 
        // and modify underlying data structure
        // Cannot explicitly call submit of InputChips component without nasty workarounds
        // Modify conditions if validity checks ever change
        if (tagList.length < maxTags && tagList.includes(tagValue) === false) {
            tagList = [...tagList, tagValue];
            tagInput = '';        
        }
    }

    // Checking Title and description values on user input
    $: {
        if (titleText.length < minTitleLength) {
            titleValid = false;
            titleState = 'input-error';
        }
        else {
            titleValid = true;
            titleState = 'input-success';
        }

        if (descriptionText.length < minDescriptionLength) {
            descriptionValid = false;
            descriptionState = 'input-error';
        }
        else {
            descriptionValid = true;
            descriptionState = 'input-success';
        }
    }

    async function postTicket() {
       if (titleValid && descriptionValid) {
            // Post the ticket...
            if ($ndk.activeUser) {
                const event = new TicketEvent($ndk);

                event.title = titleText;
                event.description = descriptionText;
                event.status = TicketStatus.New;
                tagList.forEach((tag) => {
                    event.tags.push(['t', tag]);
                });
                // Generate 'd' tag and tags from description hashtags
                event.generateTags();
                await event.publish(
                    new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)
                );
            

            // Ticket posted Modal
            const modal: ModalSettings = {
                type: 'alert',
                // Data
                title: 'Success!',
                body: 'Ticket posted successfully!',
                buttonTextCancel:'Ok',
            };
            modalStore.trigger(modal);
            } else {
                const t: ToastSettings = {
                    message: 'No Active User to post the Ticket!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        }
        else {
            const t: ToastSettings = {
                message: '<p style="text-align:center;"><strong>Invalid Ticket!</strong></p><br/>Please fill in a <strong>valid Ticket Title</strong> and <strong>Description</strong> before posting!',
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);
        }
    }
			
</script>

<div class="flex justify-center">
    <div class="p-4">
        <label class="label max-w-md">
            <span class="text-2xl">Ticket Title(min. 10chars)</span>
            <input 
                class="input {titleState}"
                type="text"
                placeholder="Title of your Ticket"
                minlength={minTitleLength}
                bind:value={titleText}
            />
        </label>


        <label class="label max-w-xl mt-8">
            <span class="text-2xl">Ticket Description(min. 20chars)</span>
            <textarea 
                class="textarea {descriptionState}"
                rows="4"
                placeholder="Detailed description of your issue"
                minlength={minDescriptionLength}
                bind:value={descriptionText}
            />
        </label>


        <div class="text-token max-w-sm gap-y-2 mt-8">
            <span class="text-2xl">Ticket Tags(max. 5pcs)</span>
            <InputChip
                bind:input={tagInput}
                bind:value={tagList}
                name="tags"
                placeholder="Enter tag value..."
                max={maxTags}
                minlength={2}
                maxlength={20}
            />


            <div class="card max-w-sm pb-4 overflow-y-auto max-h-32" tabindex="-1">
                <Autocomplete
                    bind:input={tagInput}
                    options={tagOptions}
                    on:selection={onTagSelection}
                />
            </div>
        </div>
    </div>
</div>

<div class="flex justify-center mt-8">
    <button type="button"
        class="btn btn-lg bg-gradient-to-br variant-gradient-primary-tertiary"
        on:click={postTicket}
    >
        <span>Post Ticket</span>
    </button>
</div>
