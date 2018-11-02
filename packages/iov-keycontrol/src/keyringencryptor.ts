import { As } from "type-tagger";

import {
  Random,
  Xchacha20poly1305Ietf,
  Xchacha20poly1305IetfCiphertext,
  Xchacha20poly1305IetfKey,
  Xchacha20poly1305IetfMessage,
  Xchacha20poly1305IetfNonce,
} from "@iov/crypto";
import { Encoding } from "@iov/encoding";

import { KeyringSerializationString } from "./keyring";

const { toUtf8 } = Encoding;

export type EncryptedKeyring = Uint8Array & As<"encrypted-keyring">;

export class KeyringEncryptor {
  public static async encrypt(
    keyringSerialization: KeyringSerializationString,
    encryptionKey: Uint8Array,
  ): Promise<EncryptedKeyring> {
    if (encryptionKey.length !== 32) {
      throw new Error("32 byte encryption key expected");
    }

    // Format version 1 specs:
    // - encode keyring serialization as UTF-8
    // - use Xchacha20poly1305Ietf with 24 byte nonce
    // - prepend nonce to ciphertext
    const keyringPlaintext = toUtf8(keyringSerialization) as Xchacha20poly1305IetfMessage;
    const keyringNonce = await KeyringEncryptor.makeXchacha20poly1305IetfNonce();
    const keyringCiphertext = await Xchacha20poly1305Ietf.encrypt(
      keyringPlaintext,
      encryptionKey as Xchacha20poly1305IetfKey,
      keyringNonce,
    );
    const out = new Uint8Array([...keyringNonce, ...keyringCiphertext]);
    return out as EncryptedKeyring;
  }

  public static async decrypt(
    encrypted: EncryptedKeyring,
    encryptionKey: Uint8Array,
  ): Promise<KeyringSerializationString> {
    const nonceLength = 24;
    const nonce = encrypted.slice(0, nonceLength) as Xchacha20poly1305IetfNonce;
    const ciphertext = encrypted.slice(nonceLength) as Xchacha20poly1305IetfCiphertext;
    const decrypted = await Xchacha20poly1305Ietf.decrypt(
      ciphertext,
      encryptionKey as Xchacha20poly1305IetfKey,
      nonce,
    );
    return Encoding.fromUtf8(decrypted) as KeyringSerializationString;
  }

  private static async makeXchacha20poly1305IetfNonce(): Promise<Xchacha20poly1305IetfNonce> {
    return (await Random.getBytes(24)) as Xchacha20poly1305IetfNonce;
  }
}
