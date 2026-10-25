import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeRateLimit, resetRateLimit } from "../lib/rate-limit";

test("blocks a key after the limit", () => {
  resetRateLimit("login:1");
  assert.equal(consumeRateLimit("login:1", 2, 1000, 1).allowed, true);
  assert.equal(consumeRateLimit("login:1", 2, 1000, 2).allowed, true);
  const blocked = consumeRateLimit("login:1", 2, 1000, 3);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("resets after the window", () => {
  resetRateLimit("login:2");
  consumeRateLimit("login:2", 1, 10, 10);
  assert.equal(consumeRateLimit("login:2", 1, 10, 21).allowed, true);
});
