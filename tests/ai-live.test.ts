import assert from "node:assert/strict";
import { test } from "node:test";
import { generateText } from "../lib/ai/router";
import type { ProviderId } from "../lib/ai/types";

const live = process.env.LIVE_AI_TESTS === "true";

const cases: Array<{ provider: Exclude<ProviderId, "mock">; model: string; env: string }> = [
  { provider: "openai", model: "gpt-4o-mini", env: "OPENAI_API_KEY" },
  { provider: "gemini", model: "gemini-2.0-flash", env: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { provider: "anthropic", model: "claude-haiku-4-5", env: "ANTHROPIC_API_KEY" },
];

for (const item of cases) {
  const skip = !live || !process.env[item.env];
  test(`live ${item.provider} generate responds`, { skip }, async () => {
    const previous = process.env.AI_MOCK_MODE;
    process.env.AI_MOCK_MODE = "false";
    try {
      const result = await generateText({
        provider: item.provider,
        model: item.model,
        messages: [{ role: "user", content: "Reply with the single word pong." }],
        apiKey: process.env[item.env]!,
        maxOutputTokens: 16,
        temperature: 0,
      });
      assert.ok(result.text.trim().length > 0);
      assert.ok(result.usage.inputTokens + result.usage.outputTokens >= 1);
      assert.equal(result.provider, item.provider);
    } finally {
      process.env.AI_MOCK_MODE = previous ?? "true";
    }
  });
}
