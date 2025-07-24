export enum Pricing {
    Absolute = 0,
    Hourly = 1,
    // This has been postponed
    // MilestoneBased = 2,
}

export interface ZapSplit {
    pubkey: string;
    relayHint?: string;
    percentage: number;
}
