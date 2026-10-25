import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptSecret,
  encryptSecret,
  generateToken,
  hashToken,
  parseEncryptionKey,
  tokensMatch,
} from "../lib/crypto";

test("hashes tokens one way", () => {
  const token = generateToken();
  const hashed = hashToken(token);
  assert.notEqual(hashed, token);
  assert.equal(tokensMatch(token, hashed), true);
  assert.equal(tokensMatch("other", hashed), false);
});

test("encrypts and decrypts secrets", () => {
  const key = parseEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  assert.ok(key);
  const payload = encryptSecret("sk-live-example", key);
  assert.equal(payload.includes("sk-live-example"), false);
  assert.equal(decryptSecret(payload, key), "sk-live-example");
});
