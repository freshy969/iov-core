import { ChainId, PrehashType, PublicIdentity, SignableBytes, SignatureBytes } from "@iov/bcp";
import { ValueAndUpdates } from "@iov/stream";
import { Wallet, WalletId, WalletImplementationIdString, WalletSerializationString } from "../wallet";
export declare class Ed25519Wallet implements Wallet {
    private static readonly idPool;
    private static readonly idsPrng;
    private static generateId;
    private static identityId;
    private static algorithmFromString;
    private static buildIdentity;
    readonly label: ValueAndUpdates<string | undefined>;
    readonly canSign: ValueAndUpdates<boolean>;
    readonly implementationId: WalletImplementationIdString;
    readonly id: WalletId;
    private readonly labelProducer;
    private readonly identities;
    private readonly privkeys;
    private readonly labels;
    constructor(data?: WalletSerializationString);
    setLabel(label: string | undefined): void;
    previewIdentity(chainId: ChainId, options: unknown): Promise<PublicIdentity>;
    createIdentity(chainId: ChainId, options: unknown): Promise<PublicIdentity>;
    setIdentityLabel(identity: PublicIdentity, label: string | undefined): void;
    getIdentityLabel(identity: PublicIdentity): string | undefined;
    getIdentities(): ReadonlyArray<PublicIdentity>;
    createTransactionSignature(identity: PublicIdentity, transactionBytes: SignableBytes, prehashType: PrehashType): Promise<SignatureBytes>;
    printableSecret(): string;
    serialize(): WalletSerializationString;
    clone(): Ed25519Wallet;
    private privateKeyForIdentity;
}
