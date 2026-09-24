import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

// scrypt at N=2^17 is intentionally slow — that is the point of the parameter.
// Each hash costs ~100-300ms, so these tests get a generous timeout.
const TIMEOUT = 30_000;

describe("password hashing", { timeout: TIMEOUT }, () => {
  test("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("Correct horse battery staple", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  test("produces a different hash each time", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);
    assert.notEqual(a, b, "salt should make identical passwords hash differently");
    assert.equal(await verifyPassword("same password", a), true);
    assert.equal(await verifyPassword("same password", b), true);
  });

  test("records its parameters in the hash string", async () => {
    const hash = await hashPassword("whatever");
    const parts = hash.split("$");
    assert.equal(parts.length, 6);
    assert.equal(parts[0], "scrypt");
    assert.equal(Number(parts[1]), 2 ** 17);
  });

  test("handles unicode and long passwords", async () => {
    const unicode = "pässwörd–ünïcodé–🔑";
    assert.equal(await verifyPassword(unicode, await hashPassword(unicode)), true);

    const long = "x".repeat(200);
    assert.equal(await verifyPassword(long, await hashPassword(long)), true);
  });

  test("treats equivalent unicode forms as the same password", async () => {
    // NFC "\u00e9" vs NFD "e" + combining acute (U+0065 U+0301): visually
    // identical, different bytes. Without NFKC normalization a user could be
    // locked out depending on which keyboard or OS produced the password.
    const nfc = "caf\u00e9";
    const nfd = "cafe\u0301";
    assert.notEqual(nfc.length, nfd.length, "fixture must differ before normalization");

    const hash = await hashPassword(nfc);
    assert.equal(await verifyPassword(nfd, hash), true);
  });

  test("returns false rather than throwing on a malformed hash", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$only$three",
      "bcrypt$131072$8$1$c2FsdA==$aGFzaA==",
      "scrypt$notanumber$8$1$c2FsdA==$aGFzaA==",
      "scrypt$131072$8$1$$",
    ]) {
      assert.equal(await verifyPassword("password", bad), false, `should reject ${JSON.stringify(bad)}`);
    }
  });
});
