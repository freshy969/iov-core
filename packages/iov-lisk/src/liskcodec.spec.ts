import {
  Address,
  Algorithm,
  ChainId,
  isSendTransaction,
  Nonce,
  PostableBytes,
  PublicIdentity,
  PublicKeyBytes,
  SendTransaction,
  SignatureBytes,
  SignedTransaction,
  TokenTicker,
} from "@iov/bcp-types";
import { Encoding, Int53 } from "@iov/encoding";

import { liskCodec } from "./liskcodec";

const { fromHex } = Encoding;

// use nethash as chain ID
const liskTestnet = "da3ed6a45429278bac2666961289ca17ad86595d33b31037615d4b8e8f158bba" as ChainId;
const liskEpochAsUnixTimestamp = 1464109200;
const defaultCreationTimestamp = new Int53(865708731 + liskEpochAsUnixTimestamp);

describe("liskCodec", () => {
  it("derives addresses properly", () => {
    // https://testnet-explorer.lisk.io/address/6076671634347365051L
    const identity: PublicIdentity = {
      chainId: liskTestnet,
      pubkey: {
        algo: Algorithm.Ed25519,
        data: fromHex("f4852b270f76dc8b49bfa88de5906e81d3b001d23852f0e74ba60cac7180a184") as PublicKeyBytes,
      },
    };
    expect(liskCodec.identityToAddress(identity)).toEqual("6076671634347365051L");
  });

  it("can create bytes to post", () => {
    const pubkey = fromHex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");

    const tx: SendTransaction = {
      kind: "bcp/send",
      creator: {
        chainId: liskTestnet,
        pubkey: {
          algo: Algorithm.Ed25519,
          data: pubkey as PublicKeyBytes,
        },
      },
      amount: {
        quantity: "123456789",
        fractionalDigits: 8,
        tokenTicker: "LSK" as TokenTicker,
      },
      recipient: "10010344879730196491L" as Address,
    };

    const signed: SignedTransaction = {
      transaction: tx,
      primarySignature: {
        nonce: defaultCreationTimestamp as Nonce,
        pubkey: {
          algo: Algorithm.Ed25519,
          data: pubkey as PublicKeyBytes,
        },
        signature: fromHex("26272829") as SignatureBytes,
      },
      otherSignatures: [],
    };

    const bytes = liskCodec.bytesToPost(signed);
    expect(bytes).toBeTruthy();

    expect(JSON.parse(Encoding.fromUtf8(bytes))).toEqual({
      type: 0,
      timestamp: 865708731,
      amount: "123456789",
      fee: "10000000",
      recipientId: "10010344879730196491L",
      senderPublicKey: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      signature: "26272829",
      id: "15806479375328957764",
      asset: {},
    });
  });

  it("can parse transaction", () => {
    // curl -s 'https://testnet.lisk.io/api/transactions?id=9181508057602672832' | jq '.data[0]'
    const serialized = Encoding.toUtf8(`
      {
        "id": "9181508057602672832",
        "height": 6309471,
        "blockId": "1008284795900419624",
        "type": 0,
        "timestamp": 73863961,
        "senderPublicKey": "06ad4341a609af2de837e1156f81849b05bf3c280940a9f45db76d09a3a3f2fa",
        "senderId": "10176009299933723198L",
        "recipientId": "6076671634347365051L",
        "recipientPublicKey": "f4852b270f76dc8b49bfa88de5906e81d3b001d23852f0e74ba60cac7180a184",
        "amount": "244550000",
        "fee": "10000000",
        "signature": "9a6c75056151d76791b69d268102241aa0f5930d098a1af48bab9b6e7706afcf24156ae2a7178cf1c3b7865094653dcaf99cdd7cb7aa9a8a3e5c4121f2a44a00",
        "signatures": [],
        "confirmations": 101,
        "asset": {
          "data": "Yet another Lisk transaction generated by IOV-Core"
        }
      }
    `) as PostableBytes;

    const parsed = liskCodec.parseBytes(serialized, liskTestnet);
    const unsigned = parsed.transaction;
    if (!isSendTransaction(unsigned)) {
      throw new Error("wrong transaction kind");
    }
    expect(unsigned.fee).toBeTruthy();
    expect(unsigned.fee!.quantity).toEqual("10000000");
    expect(unsigned.fee!.fractionalDigits).toEqual(8);
    expect(unsigned.fee!.tokenTicker).toEqual("LSK");
    expect(unsigned.amount).toBeTruthy();
    expect(unsigned.amount.quantity).toEqual("244550000");
    expect(unsigned.amount.fractionalDigits).toEqual(8);
    expect(unsigned.amount.tokenTicker).toEqual("LSK");
    expect(unsigned.memo).toEqual("Yet another Lisk transaction generated by IOV-Core");
    expect(unsigned.creator.chainId).toEqual(liskTestnet);
    expect(unsigned.creator.pubkey.algo).toEqual(Algorithm.Ed25519);
    expect(unsigned.creator.pubkey.data).toEqual(
      fromHex("06ad4341a609af2de837e1156f81849b05bf3c280940a9f45db76d09a3a3f2fa"),
    );
    expect(unsigned.recipient).toEqual("6076671634347365051L");

    expect(parsed.primarySignature.nonce).toEqual(new Int53(73863961 + liskEpochAsUnixTimestamp) as Nonce);
    expect(parsed.primarySignature.pubkey.algo).toEqual(Algorithm.Ed25519);
    expect(parsed.primarySignature.pubkey.data).toEqual(
      fromHex("06ad4341a609af2de837e1156f81849b05bf3c280940a9f45db76d09a3a3f2fa"),
    );
    expect(parsed.primarySignature.signature).toEqual(
      fromHex(
        "9a6c75056151d76791b69d268102241aa0f5930d098a1af48bab9b6e7706afcf24156ae2a7178cf1c3b7865094653dcaf99cdd7cb7aa9a8a3e5c4121f2a44a00",
      ),
    );
    expect(parsed.otherSignatures).toEqual([]);
  });
});
