import Long from "long";
import { As } from "type-tagger";

import {
  Address,
  Algorithm,
  ChainId,
  ConfirmedTransaction,
  Hash,
  Identity,
  isSwapAbortTransaction,
  isSwapClaimTransaction,
  isSwapOfferTransaction,
  Nonce,
  PublicKeyBundle,
  SignableBytes,
  SwapAbortTransaction,
  SwapClaimTransaction,
  SwapOfferTransaction,
  TransactionQuery,
  WithCreator,
} from "@iov/bcp";
import { Sha256 } from "@iov/crypto";
import { Bech32, Encoding } from "@iov/encoding";
import { QueryString } from "@iov/tendermint-rpc";

const bnsMainnetChainId = "PLEASE_INSERT_HERE_WHEN_GENESIS_EXISTS" as ChainId;

export function addressPrefix(chainId: ChainId): "iov" | "tiov" {
  return chainId === bnsMainnetChainId ? "iov" : "tiov";
}

/** Encodes raw bytes into a bech32 address */
export function encodeBnsAddress(prefix: "iov" | "tiov", bytes: Uint8Array): Address {
  return Bech32.encode(prefix, bytes) as Address;
}

/** Decodes a printable address into bech32 object */
export function decodeBnsAddress(address: Address): { readonly prefix: string; readonly data: Uint8Array } {
  return Bech32.decode(address);
}

function algoToPrefix(algo: Algorithm): Uint8Array {
  switch (algo) {
    case Algorithm.Ed25519:
      return Encoding.toAscii("sigs/ed25519/");
    case Algorithm.Secp256k1:
      return Encoding.toAscii("sigs/secp256k1/");
    default:
      throw new Error("Unsupported algorithm: " + algo);
  }
}

function keyToIdentifier(key: PublicKeyBundle): Uint8Array {
  return Uint8Array.from([...algoToPrefix(key.algo), ...key.data]);
}

export function identityToAddress(identity: Identity): Address {
  const prefix = addressPrefix(identity.chainId);
  const bytes = new Sha256(keyToIdentifier(identity.pubkey)).digest().slice(0, 20);
  return encodeBnsAddress(prefix, bytes);
}

// TODO: this maps to weave code... maybe we change a bit??
// This is the same logic as keyToIdentifier...
export type Condition = Uint8Array & As<"Condition">;

function buildCondition(extension: string, typ: string, id: Uint8Array): Condition {
  // https://github.com/iov-one/weave/blob/v0.13.0/conditions.go#L33-L36
  const res = Uint8Array.from([...Encoding.toAscii(`${extension}/${typ}/`), ...id]);
  return res as Condition;
}

export function escrowCondition(id: Uint8Array): Condition {
  // https://github.com/iov-one/weave/blob/v0.13.0/x/escrow/model.go#L90
  return buildCondition("escrow", "seq", id);
}

export function conditionToAddress(chainId: ChainId, cond: Condition): Address {
  const prefix = addressPrefix(chainId);
  const bytes = new Sha256(cond).digest().slice(0, 20);
  return encodeBnsAddress(prefix, bytes);
}

export function isValidAddress(address: string): boolean {
  try {
    decodeBnsAddress(address as Address);
    return true;
  } catch {
    return false;
  }
}

const signCodev1: Uint8Array = Uint8Array.from([0, 0xca, 0xfe, 0]);

// append chainID and nonce to the raw tx bytes to prepare for signing
export function appendSignBytes(bz: Uint8Array, chainId: ChainId, nonce: Nonce): SignableBytes {
  if (chainId.length > 255) {
    throw new Error("chainId must not exceed a length of 255 characters");
  }
  return Uint8Array.from([
    ...signCodev1,
    chainId.length,
    ...Encoding.toAscii(chainId),
    ...Long.fromNumber(nonce).toBytesBE(),
    ...bz,
  ]) as SignableBytes;
}

export function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Type to differentiate between a raw hash of the data and the id used internally in weave */
export type HashId = Uint8Array & As<"hashid">;

const hashIdentifierPrefix = Encoding.toAscii("hash/sha256/");

export function hashIdentifier(hash: Hash): HashId {
  return Uint8Array.from([...hashIdentifierPrefix, ...hash]) as HashId;
}

export function isHashIdentifier(ident: Uint8Array): ident is HashId {
  const prefix = ident.slice(0, hashIdentifierPrefix.length);
  return arraysEqual(hashIdentifierPrefix, prefix);
}

export function hashFromIdentifier(ident: HashId): Hash {
  return ident.slice(hashIdentifierPrefix.length) as Hash;
}

// calculate keys for query tags
export function bucketKey(bucket: string): Uint8Array {
  return Encoding.toAscii(`${bucket}:`);
}

export function indexKey(bucket: string, index: string): Uint8Array {
  return Encoding.toAscii(`_i.${bucket}_${index}:`);
}

export function isConfirmedWithSwapOfferTransaction(
  tx: ConfirmedTransaction,
): tx is ConfirmedTransaction<SwapOfferTransaction & WithCreator> {
  const unsigned = tx.transaction;
  return isSwapOfferTransaction(unsigned);
}

export function isConfirmedWithSwapClaimOrAbortTransaction(
  tx: ConfirmedTransaction,
): tx is ConfirmedTransaction<(SwapClaimTransaction | SwapAbortTransaction) & WithCreator> {
  const unsigned = tx.transaction;
  return isSwapClaimTransaction(unsigned) || isSwapAbortTransaction(unsigned);
}

function sentFromOrToTag(addr: Address): string {
  const id = Uint8Array.from([...Encoding.toAscii("cash:"), ...decodeBnsAddress(addr).data]);
  const key = Encoding.toHex(id).toUpperCase();
  const value = "s"; // "s" for "set"
  return `${key}='${value}'`;
}

function signedByTag(addr: Address): string {
  const id = Uint8Array.from([...Encoding.toAscii("sigs:"), ...decodeBnsAddress(addr).data]);
  const key = Encoding.toHex(id).toUpperCase();
  const value = "s"; // "s" for "set"
  return `${key}='${value}'`;
}

export function buildQueryString(query: TransactionQuery): QueryString {
  const sentComponents = query.sentFromOrTo !== undefined ? [sentFromOrToTag(query.sentFromOrTo)] : [];
  const signedByComponents = query.signedBy !== undefined ? [signedByTag(query.signedBy)] : [];
  const tagComponents = query.tags !== undefined ? query.tags.map(tag => `${tag.key}='${tag.value}'`) : [];
  // In Tendermint, hash can be lower case for search queries but must be upper case for subscribe queries
  const hashComponents = query.id !== undefined ? [`tx.hash='${query.id}'`] : [];
  const heightComponents = query.height !== undefined ? [`tx.height=${query.height}`] : [];
  const minHeightComponents = query.minHeight !== undefined ? [`tx.height>${query.minHeight}`] : [];
  const maxHeightComponents = query.maxHeight !== undefined ? [`tx.height<${query.maxHeight}`] : [];

  const components: ReadonlyArray<string> = [
    ...sentComponents,
    ...signedByComponents,
    ...tagComponents,
    ...hashComponents,
    ...heightComponents,
    ...minHeightComponents,
    ...maxHeightComponents,
  ];
  return components.join(" AND ") as QueryString;
}
