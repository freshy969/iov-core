import { Encoding } from "@iov/crypto";

import { v0_20 } from "./adaptor";
import { Client } from "./client";
import { randomId } from "./common";
import { QueryString } from "./encodings";
import * as responses from "./responses";
import { HttpClient, RpcClient, WebsocketClient } from "./rpcclient";

const skipTests = (): boolean => !process.env.TENDERMINT_ENABLED;

const pendingWithoutTendermint = () => {
  if (skipTests()) {
    pending("Set TENDERMINT_ENABLED to enable tendermint-based tests");
  }
};

// TODO: make flexible, support multiple versions, etc...
const tendermintUrl = "localhost:12345";

const buildKvTx = (k: string, v: string): Uint8Array => Encoding.asAscii(`${k}=${v}`);

const kvTestSuite = (msg: string, rpcFactory: () => RpcClient) => {
  const key = randomId();
  const value = randomId();

  beforeEach(pendingWithoutTendermint);

  describe(msg, () => {
    it("Tries to connect with known version to tendermint", async () => {
      const client = new Client(rpcFactory(), v0_20);
      expect(await client.abciInfo()).toBeTruthy();
    });

    it("Tries to auto-discover tendermint", async () => {
      const client = await Client.detectVersion(rpcFactory());
      const info = await client.abciInfo();
      expect(info).toBeTruthy();
    });

    it("Posts a transaction", async () => {
      const client = new Client(rpcFactory(), v0_20);
      const tx = buildKvTx(key, value);

      const response = await client.broadcastTxCommit({ tx: tx });
      expect(response.height).toBeGreaterThan(2);
      expect(response.hash.length).toEqual(20);
      // verify success
      expect(response.checkTx.code).toBeFalsy();
      expect(response.deliverTx).toBeTruthy();
      if (response.deliverTx) {
        expect(response.deliverTx.code).toBeFalsy();
      }
    });

    it("Queries the state", async () => {
      const client = new Client(rpcFactory(), v0_20);

      const binKey = Encoding.asAscii(key);
      const binValue = Encoding.asAscii(value);
      const queryParams = { path: "/key", data: binKey };

      const response = await client.abciQuery(queryParams);
      expect(new Uint8Array(response.key)).toEqual(binKey);
      expect(new Uint8Array(response.value)).toEqual(binValue);
      expect(response.code).toBeFalsy();
    });

    it("Sanity check - calls don't error", async () => {
      const client = new Client(rpcFactory(), v0_20);

      expect(await client.block()).toBeTruthy();
      expect(await client.blockchain(2, 4)).toBeTruthy();
      expect(await client.blockResults(3)).toBeTruthy();
      expect(await client.commit(4)).toBeTruthy();
      expect(await client.genesis()).toBeTruthy();
      expect(await client.health()).toBeNull();
      expect(await client.status()).toBeTruthy();
      expect(await client.validators()).toBeTruthy();
    });

    it("Can query a tx properly", async () => {
      const client = new Client(rpcFactory(), v0_20);

      const find = randomId();
      const me = randomId();
      const tx = buildKvTx(find, me);

      const txRes = await client.broadcastTxCommit({ tx });
      expect(responses.txCommitSuccess(txRes)).toBeTruthy();
      expect(txRes.height).toBeTruthy();
      const height: number = txRes.height || 0; // || 0 for type system
      expect(txRes.hash.length).not.toEqual(0);
      const hash = txRes.hash;

      // find by hash - does it match?
      const r = await client.tx({ hash, prove: true });
      // both values come from rpc, so same type (Buffer/Uint8Array)
      expect(r.hash).toEqual(hash);
      // force the type when comparing to locally generated value
      expect(new Uint8Array(r.tx)).toEqual(tx);
      expect(r.height).toEqual(height);
      expect(r.proof).toBeTruthy();

      // txSearch - you must enable the indexer when running
      // tendermint, else you get empty results
      const query = `app.key='${find}'` as QueryString;
      const s = await client.txSearch({ query, page: 1, per_page: 30 });
      // should find the tx
      expect(s.totalCount).toEqual(1);
      // should return same info as querying directly,
      // except without the proof
      expect(s.txs[0]).toEqual({ ...r, proof: undefined });

      // and let's query the block itself to see this transaction
      const block = await client.block(height);
      expect(block.blockMeta.header.numTxs).toEqual(1);
      expect(block.block.txs.length).toEqual(1);
      expect(block.block.txs[0]).toEqual(tx);
    });
  });
};

describe("Verify client calls on tendermint w/ kvstore app", () => {
  kvTestSuite("With HttpClient", () => new HttpClient(tendermintUrl));
  kvTestSuite("With WebsocketClient", () => new WebsocketClient(tendermintUrl));
});
