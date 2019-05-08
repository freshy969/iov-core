import * as Long from "long";
import { As } from "type-tagger";

import {
  Address,
  Algorithm,
  ChainId,
  FullSignature,
  isSendTransaction,
  isSwapAbortTransaction,
  isSwapClaimTransaction,
  isSwapOfferTransaction,
  LightTransaction,
  Nonce,
  PublicKeyBundle,
  PublicKeyBytes,
  SendTransaction,
  SignatureBytes,
  SwapAbortTransaction,
  SwapClaimTransaction,
  SwapOfferTransaction,
  TokenTicker,
} from "@iov/bcp";

import { Int53 } from "@iov/encoding";

import * as codecImpl from "./generated/codecimpl";

export interface ChainAddressPair {
  readonly chainId: ChainId;
  readonly address: Address;
}

// blockchain NFT

export interface BnsBlockchainNft {
  readonly id: string;
  readonly owner: Address;
  /**
   * The registered chain information
   *
   * Fields as defined in https://github.com/iov-one/bns-spec/blob/master/docs/data/ObjectDefinitions.rst#chain
   */
  readonly chain: {
    readonly chainId: ChainId;
    readonly name: string;
    readonly enabled: boolean;
    readonly production: boolean;
    readonly networkId: string | undefined;
    readonly mainTickerId: TokenTicker | undefined;
  };
  readonly codecName: string;
  readonly codecConfig: string;
}

export interface BnsBlockchainsByChainIdQuery {
  readonly chainId: ChainId;
}

export type BnsBlockchainsQuery = BnsBlockchainsByChainIdQuery;

export function isBnsBlockchainsByChainIdQuery(
  query: BnsBlockchainsQuery,
): query is BnsBlockchainsByChainIdQuery {
  return typeof query.chainId !== "undefined";
}

// username NFT

export interface BnsUsernameNft {
  readonly id: string;
  readonly owner: Address;
  readonly addresses: ReadonlyArray<ChainAddressPair>;
}

export interface BnsUsernamesByUsernameQuery {
  readonly username: string;
}

export interface BnsUsernamesByOwnerAddressQuery {
  readonly owner: Address;
}

export interface BnsUsernamesByChainAndAddressQuery {
  readonly chain: ChainId;
  readonly address: Address;
}

export type BnsUsernamesQuery =
  | BnsUsernamesByUsernameQuery
  | BnsUsernamesByOwnerAddressQuery
  | BnsUsernamesByChainAndAddressQuery;

export function isBnsUsernamesByUsernameQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByUsernameQuery {
  return typeof (query as BnsUsernamesByUsernameQuery).username !== "undefined";
}

export function isBnsUsernamesByOwnerAddressQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByOwnerAddressQuery {
  return typeof (query as BnsUsernamesByOwnerAddressQuery).owner !== "undefined";
}

export function isBnsUsernamesByChainAndAddressQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByChainAndAddressQuery {
  return (
    typeof (query as BnsUsernamesByChainAndAddressQuery).chain !== "undefined" &&
    typeof (query as BnsUsernamesByChainAndAddressQuery).address !== "undefined"
  );
}

// Rest

export type PrivateKeyBytes = Uint8Array & As<"private-key">;
export interface PrivateKeyBundle {
  readonly algo: Algorithm;
  readonly data: PrivateKeyBytes;
}

export interface Result {
  readonly key: Uint8Array;
  readonly value: Uint8Array;
}

export interface Keyed {
  readonly _id: Uint8Array;
}

export interface Decoder<T extends {}> {
  readonly decode: (data: Uint8Array) => T;
}

export function decodePubkey(publicKey: codecImpl.crypto.IPublicKey): PublicKeyBundle {
  if (publicKey.ed25519) {
    return {
      algo: Algorithm.Ed25519,
      data: publicKey.ed25519 as PublicKeyBytes,
    };
  } else {
    throw new Error("Unknown public key algorithm");
  }
}

export function decodePrivkey(privateKey: codecImpl.crypto.IPrivateKey): PrivateKeyBundle {
  if (privateKey.ed25519) {
    return {
      algo: Algorithm.Ed25519,
      data: privateKey.ed25519 as PrivateKeyBytes,
    };
  } else {
    throw new Error("Unknown private key algorithm");
  }
}

export function decodeSignature(signature: codecImpl.crypto.ISignature): SignatureBytes {
  if (signature.ed25519) {
    return signature.ed25519 as SignatureBytes;
  } else {
    throw new Error("Unknown private key algorithm");
  }
}

export function decodeFullSig(sig: codecImpl.sigs.IStdSignature): FullSignature {
  return {
    nonce: asInt53(sig.sequence).toNumber() as Nonce,
    pubkey: decodePubkey(ensure(sig.pubkey)),
    signature: decodeSignature(ensure(sig.signature)),
  };
}

/**
 * Decodes a protobuf int field (int32/uint32/int64/uint64) into a JavaScript
 * number.
 */
export function asIntegerNumber(maybeLong: Long | number | null | undefined): number {
  if (!maybeLong) {
    return 0;
  } else if (typeof maybeLong === "number") {
    if (!Number.isInteger(maybeLong)) {
      throw new Error("Number is not an integer.");
    }
    return maybeLong;
  } else {
    return maybeLong.toInt();
  }
}

export function asInt53(input: Long | number | null | undefined): Int53 {
  if (!input) {
    return new Int53(0);
  } else if (typeof input === "number") {
    return new Int53(input);
  } else {
    return Int53.fromString(input.toString());
  }
}

export function ensure<T>(maybe: T | null | undefined, msg?: string): T {
  if (maybe === null || maybe === undefined) {
    throw new Error("missing " + (msg || "field"));
  }
  return maybe;
}

// transactions

export interface AddAddressToUsernameTx extends LightTransaction {
  readonly kind: "bns/add_address_to_username";
  /** the username to be updated, must exist on chain */
  readonly username: string;
  readonly payload: ChainAddressPair;
}

export interface RegisterUsernameTx extends LightTransaction {
  readonly kind: "bns/register_username";
  readonly username: string;
  readonly addresses: ReadonlyArray<ChainAddressPair>;
}

export interface RemoveAddressFromUsernameTx extends LightTransaction {
  readonly kind: "bns/remove_address_from_username";
  /** the username to be updated, must exist on chain */
  readonly username: string;
  readonly payload: ChainAddressPair;
}

export type BnsTx =
  // BCP
  | SendTransaction
  | SwapOfferTransaction
  | SwapClaimTransaction
  | SwapAbortTransaction
  // BNS
  | AddAddressToUsernameTx
  | RegisterUsernameTx
  | RemoveAddressFromUsernameTx;

export function isBnsTx(transaction: LightTransaction): transaction is BnsTx {
  if (
    isSendTransaction(transaction) ||
    isSwapOfferTransaction(transaction) ||
    isSwapClaimTransaction(transaction) ||
    isSwapAbortTransaction(transaction)
  ) {
    return true;
  }

  return transaction.kind.startsWith("bns/");
}

export function isAddAddressToUsernameTx(
  transaction: LightTransaction,
): transaction is AddAddressToUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/add_address_to_username";
}

export function isRegisterUsernameTx(transaction: LightTransaction): transaction is RegisterUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/register_username";
}

export function isRemoveAddressFromUsernameTx(
  transaction: LightTransaction,
): transaction is RemoveAddressFromUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/remove_address_from_username";
}
