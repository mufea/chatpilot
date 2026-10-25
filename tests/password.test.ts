import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../lib/auth/password";

test("rejects weak passwords", () => {
  assert.ok(validatePasswordStrength("short").length > 0);
  assert.ok(validatePasswordStrength("lettersonly").length > 0);
  assert.ok(validatePasswordStrength("12345678").length > 0);
  assert.equal(validatePasswordStrength("ValidPass1").length, 0);
});

test("hashes and verifies passwords", async () => {
  const hash = await hashPassword("ValidPass1");
  assert.notEqual(hash, "ValidPass1");
  assert.equal(await verifyPassword("ValidPass1", hash), true);
  assert.equal(await verifyPassword("WrongPass1", hash), false);
});
