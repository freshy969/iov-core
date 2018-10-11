import { Address, BcpConnection, BcpTransactionResponse, ChainConnector, Nonce, UnsignedTransaction } from "@iov/bcp-types";
import { KeyringEntryId, UserProfile } from "@iov/keycontrol";
import { ChainId, PublicKeyBundle } from "@iov/tendermint-types";
export declare class MultiChainSigner {
    readonly profile: UserProfile;
    private readonly knownChains;
    constructor(profile: UserProfile);
    chainIds(): ReadonlyArray<ChainId>;
    connection(chainId: ChainId): BcpConnection;
    addChain(connector: ChainConnector): Promise<void>;
    keyToAddress(chainId: ChainId, key: PublicKeyBundle): Address;
    getNonce(chainId: ChainId, addr: Address): Promise<Nonce>;
    signAndCommit(tx: UnsignedTransaction, keyring: KeyringEntryId): Promise<BcpTransactionResponse>;
    /**
     * Throws for unknown chain ID
     */
    private getChain;
}