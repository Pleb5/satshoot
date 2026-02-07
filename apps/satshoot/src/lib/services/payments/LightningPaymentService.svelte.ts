import { BidEvent } from '$lib/events/BidEvent';
import { JobEvent } from '$lib/events/JobEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import ndk from '$lib/stores/session';
import currentUser from '$lib/stores/user';
import { getZapConfiguration } from '$lib/utils/helpers';
import { SatShootPubkey } from '$lib/utils/misc';
import type NDK from '@nostr-dev-kit/ndk';
import {
  NDKEvent,
  NDKKind,
  NDKRelaySet,
  NDKSubscriptionCacheUsage,
  NDKZapper,
  type NDKLnUrlData,
  type NDKSigner,
  type NDKTag,
  type NostrEvent,
} from '@nostr-dev-kit/ndk';
import { get } from 'svelte/store';
import { UserEnum } from './UserEnum';
import { nip19 } from 'nostr-tools';

export interface InvoiceDetails {
  paymentRequest: string;
  receiver: string;
  eventId: string;
  zapper?: string;
}

export type LightningAddressOverrides = Partial<Record<UserEnum, string>>;

interface NDKZapperOptions {
  /**
   * Comment to include in the zap event
   */
  comment?: string;
  /**
   * Extra tags to add to the zap event
   */
  tags?: NDKTag[];
  /**
   * Whether to use nutzap as fallback
   */
  nutzapAsFallback?: boolean;
}

/**
 * Service for Lightning Network payment operations
 */
export class LightningPaymentService {
  private freelancerPubkey: string;

  constructor(
    private primaryEntity: JobEvent | ServiceEvent,
    private secondaryEntity: BidEvent | OrderEvent
  ) {
    this.freelancerPubkey =
      this.secondaryEntity instanceof BidEvent
        ? this.secondaryEntity.pubkey
        : this.primaryEntity.pubkey;
  }

    private async getPayerContext(): Promise<{
        ndkInstance: NDK;
        signer: NDKSigner;
        payerPubkey: string;
    }> {
    const ndkInstance = get(ndk);
    const signer = ndkInstance.signer;

    if (!signer) {
      throw new Error('Signer not ready. Please log in and try again.');
    }

    try {
      const currentUserSnapshot = get(currentUser);
      console.warn('[zap] resolving signer user', {
        currentUserPubkey: currentUserSnapshot?.pubkey ?? null,
        activeUserPubkey: ndkInstance.activeUser?.pubkey ?? null,
        signerType: signer.constructor?.name ?? 'unknown',
      });
      const signerUser = await signer.user();
      console.warn('[zap] signer user resolved', {
        signerPubkey: signerUser?.pubkey ?? null,
      });
      if (!signerUser?.pubkey) {
        throw new Error('Signer user missing pubkey');
      }

      const payer = currentUserSnapshot;
      if (payer?.pubkey && payer.pubkey !== signerUser.pubkey) {
        console.warn('Signer pubkey mismatch with current user; using signer pubkey.', {
          currentUser: payer.pubkey,
          signer: signerUser.pubkey,
        });
      }

      if (!ndkInstance.activeUser || ndkInstance.activeUser.pubkey !== signerUser.pubkey) {
        ndkInstance.activeUser = signerUser;
      }

      return { ndkInstance, signer, payerPubkey: signerUser.pubkey };
    } catch (error) {
      console.error('Failed to resolve signer user for zap request', error);
      throw new Error('Signer not ready. Please reconnect and try again.');
        }
    }

    private createZapSigner(ndkInstance: NDK, signer: NDKSigner, payerPubkey: string): NDKSigner {
        const payerUser = ndkInstance.getUser({ pubkey: payerPubkey });
        return {
            get pubkey() {
                return payerPubkey;
            },
            async blockUntilReady() {
                return payerUser;
            },
            async user() {
                return payerUser;
            },
            get userSync() {
                return payerUser;
            },
            sign: (event) => signer.sign(event),
            relays: signer.relays?.bind(signer),
            encryptionEnabled: signer.encryptionEnabled?.bind(signer),
            encrypt: (recipient, value, scheme) => signer.encrypt(recipient, value, scheme),
            decrypt: (sender, value, scheme) => signer.decrypt(sender, value, scheme),
            toPayload: () => signer.toPayload(),
        };
    }

    private async buildZapRequest(
        target: NDKEvent,
        amount: number,
        zapConfig: NDKLnUrlData,
        receiver: string,
        relays: string[],
        opts: NDKZapperOptions,
        ndkInstance: NDK,
        signer: NDKSigner,
        payerPubkey: string
    ): Promise<NDKEvent> {
        const zapEndpoint = zapConfig.callback;
        const zapRequest: NostrEvent = {
            kind: NDKKind.ZapRequest,
            created_at: Math.round(Date.now() / 1000),
            content: opts.comment || '',
            tags: [
                ['p', receiver],
                ['amount', amount.toString()],
                ['relays', ...relays.slice(0, 4)],
            ],
            pubkey: payerPubkey,
        };

        const isNDKEvent = target instanceof NDKEvent;
        if (isNDKEvent) {
            const referenceTags = target.referenceTags();
            const nonPTags = referenceTags.filter((tag) => tag[0] !== 'p');
            zapRequest.tags.push(...nonPTags);
        }

        zapRequest.tags.push(['lnurl', zapEndpoint]);

        const event = new NDKEvent(ndkInstance, zapRequest as NostrEvent);
        if (opts.tags) {
            event.tags = event.tags.concat(opts.tags);
        }

        const eTaggedEvents = new Set<string>();
        const aTaggedEvents = new Set<string>();

        for (const tag of event.tags) {
            if (tag[0] === 'e') {
                eTaggedEvents.add(tag[1]);
            } else if (tag[0] === 'a') {
                aTaggedEvents.add(tag[1]);
            }
        }

        if (eTaggedEvents.size > 1) throw new Error('Only one e-tag is allowed');
        if (aTaggedEvents.size > 1) throw new Error('Only one a-tag is allowed');

        event.tags = event.tags.filter((tag) => tag[0] !== 'p');
        event.tags.push(['p', receiver]);

        event.pubkey = payerPubkey;
        const nostrEvent = await event.toNostrEvent(payerPubkey);
        event.id = nostrEvent.id ?? event.id;
        event.sig = await signer.sign(nostrEvent);

        return event;
    }

  /**
   * Process Lightning Network payment
   */
  async processPayment(
    freelancerShareMillisats: number,
    satshootSumMillisats: number,
    sponsoredSumMillisats: number,
    lightningAddressOverrides: LightningAddressOverrides = {}
  ): Promise<Map<UserEnum, boolean>> {
    const zapRequestRelays = new Map<UserEnum, string[]>();
    const invoices = new Map<UserEnum, InvoiceDetails>();
    const paid = new Map<UserEnum, boolean>([
      [UserEnum.Freelancer, false],
      [UserEnum.Satshoot, false],
      [UserEnum.Sponsored, false],
    ]);

    // Fetch payment info for freelancer
    if (freelancerShareMillisats > 0) {
      console.warn('freelancer pubkey', this.freelancerPubkey)
      await this.fetchPaymentInfo(
        UserEnum.Freelancer,
        this.freelancerPubkey,
        freelancerShareMillisats,
        zapRequestRelays,
        invoices,
        this.secondaryEntity,
        lightningAddressOverrides[UserEnum.Freelancer]
      );
    }

    // Fetch payment info for satshoot
    if (satshootSumMillisats > 0) {
      await this.fetchPaymentInfo(
        UserEnum.Satshoot,
        SatShootPubkey,
        satshootSumMillisats,
        zapRequestRelays,
        invoices,
        this.secondaryEntity,
        lightningAddressOverrides[UserEnum.Satshoot]
      );
    }

    // Fetch payment info for the sponsored npub
    if (sponsoredSumMillisats > 0) {
      const decodingResult =
        this.secondaryEntity instanceof BidEvent
          ? nip19.decode(this.secondaryEntity.sponsoredNpub)
          : nip19.decode((this.primaryEntity as ServiceEvent).sponsoredNpub);
      if (decodingResult.type === 'npub') {
        await this.fetchPaymentInfo(
          UserEnum.Sponsored,
          decodingResult.data,
          sponsoredSumMillisats,
          zapRequestRelays,
          invoices,
          this.secondaryEntity,
          lightningAddressOverrides[UserEnum.Sponsored]
        );
      } else {
        throw new Error('Expecting an npub but got something else!');
      }
    }

    // Launch payment modals and process payments
    const { init, launchPaymentModal, closeModal, onModalClosed } = await import(
      '@getalby/bitcoin-connect'
    );
    init({ appName: 'SatShoot' });

    for (const [key, invoice] of invoices.entries()) {
      if (!invoice) continue;

      launchPaymentModal({
        invoice: invoice.paymentRequest,
        onPaid: () => {
          paid.set(key, true);
          closeModal(); // Don't wait necessarily on the zap event
        },
      });

      if (!invoice.zapper) {
        throw new Error('Missing zapper pubkey for zap receipt subscription');
      }

      const filter = {
        kinds: [NDKKind.Zap],
        limit: 0,
        '#p': [invoice.receiver],
        '#P': [invoice.zapper],
      };

      try {
        const subscription = get(ndk).subscribe(
          filter,
          {
            cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
            relaySet: NDKRelaySet.fromRelayUrls(zapRequestRelays.get(key)!, get(ndk)),
          }
        );

        subscription.on('event', async (event) => {
          if (event.tagValue('bolt11') === invoice.paymentRequest && !paid.get(key)) {
            paid.set(key, true);
            closeModal();
          }
        });

        await new Promise<void>((resolve) => {
          const unsub = onModalClosed(() => {
            subscription.stop();
            resolve();
            unsub();
          });
        });
      } catch (error) {
        console.error('An error occurred in payment process', error);
        let payee;
        switch (key) {
          case UserEnum.Freelancer:
            payee = "Freelancer's";
            break;
          case UserEnum.Satshoot:
            payee = "Satshoot's";
            break;
          default:
            payee = "Sponsored Npub's";
        }
        throw new Error(`Could not fetch ${payee} zap receipt: ${error}`);
      }
    }

    return paid;
  }

  /**
   * Fetch payment information for a user
   */
  private async fetchPaymentInfo(
    userEnum: UserEnum,
    pubkey: string,
    amountMillisats: number,
    zapRequestRelays: Map<UserEnum, string[]>,
    invoices: Map<UserEnum, InvoiceDetails>,
    event: NDKEvent,
    lightningAddressOverride?: string
  ) {
    const zapConfig = await getZapConfiguration(pubkey, lightningAddressOverride);
        if (zapConfig) {
            const { ndkInstance, signer, payerPubkey } = await this.getPayerContext();
            const zapSigner = this.createZapSigner(ndkInstance, signer, payerPubkey);
            console.warn('[zap] using payer pubkey for zap request', {
                payerPubkey,
                receiverPubkey: pubkey,
            });
            const invoice = await this.generateInvoice(
                event,
                amountMillisats,
                zapConfig,
                pubkey,
                {
                    nutzapAsFallback: false,
                    comment: 'satshoot',
                    tags: [['P', payerPubkey]],
                },
                userEnum,
                zapRequestRelays,
                payerPubkey,
                ndkInstance,
                zapSigner
            );

      invoices.set(userEnum, {
        paymentRequest: invoice,
        receiver: pubkey,
        eventId: event.id,
        zapper: payerPubkey,
      });
    } else {
      throw new Error(`Could not fetch ${userEnum}'s zap config!`);
    }
  }

  /**
   * Generate Lightning invoice
   */
    private async generateInvoice(
        target: NDKEvent,
        amount: number,
        zapConfig: NDKLnUrlData,
        receiver: string,
        opts: NDKZapperOptions,
        user: UserEnum,
        zapRequestRelays: Map<UserEnum, string[]>,
        payerPubkey: string,
        ndkInstance: NDK,
        signer: NDKSigner
    ): Promise<string> {
        let signerPubkey: string | null = null;
        try {
            signerPubkey = (await signer.user())?.pubkey ?? null;
        } catch (error) {
            console.warn('[zap] signer.user() failed before buildZapRequest', error);
        }

        console.warn('[zap] buildZapRequest context', {
            signerPubkey,
            payerPubkey,
            activeUserPubkey: ndkInstance.activeUser?.pubkey ?? null,
            currentUserPubkey: get(currentUser)?.pubkey ?? null,
            targetPubkey: target.pubkey || null,
            receiverPubkey: receiver,
        });

        const zapper = new NDKZapper(target, amount, 'msat', { ...opts, ndk: ndkInstance, signer });
        const relays = await zapper.relays(receiver);

        const zapRequest = await this.buildZapRequest(
            target,
            amount,
            zapConfig,
            receiver,
            relays,
            opts,
            ndkInstance,
            signer,
            payerPubkey
        ).catch((err) => {
            console.warn('[zap] buildZapRequest failed', {
                signerPubkey,
                payerPubkey,
                activeUserPubkey: ndkInstance.activeUser?.pubkey ?? null,
                currentUserPubkey: get(currentUser)?.pubkey ?? null,
                targetPubkey: target.pubkey || null,
                receiverPubkey: receiver,
            });
            console.log('Error: An error occurred in generating zap request!', err);
            return null;
        });

    if (!zapRequest) throw new Error('Failed to generate zap request');

    const relayUrls = zapRequest.tags.find((t) => t[0] === 'relays')?.slice(1) || [];
    zapRequestRelays.set(user, relayUrls);

    const invoice = await zapper.getLnInvoice(zapRequest, amount, zapConfig).catch((err) => {
      console.log('Error: An error occurred in getting LnInvoice!', err);
      return null;
    });

    if (!invoice) throw new Error('Failed to get LNInvoice');

    return invoice;
  }
}
