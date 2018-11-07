import { FungibleToken, SignedTransaction, UnsignedTransaction } from "@iov/bcp-types";
import { PrivateKeyBundle, PublicKeyBundle } from "@iov/tendermint-types";
import * as codecImpl from "./codecimpl";
export declare function encodePubkey(publicKey: PublicKeyBundle): codecImpl.crypto.IPublicKey;
export declare function encodePrivkey(privateKey: PrivateKeyBundle): codecImpl.crypto.IPrivateKey;
export declare function encodeToken(token: FungibleToken): codecImpl.x.Coin;
export declare function buildSignedTx(tx: SignedTransaction): codecImpl.app.ITx;
export declare function buildUnsignedTx(tx: UnsignedTransaction): codecImpl.app.ITx;
export declare function buildMsg(tx: UnsignedTransaction): codecImpl.app.ITx;
