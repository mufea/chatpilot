import { AIError } from "@/lib/ai/errors";
import { estimateTokens } from "@/lib/ai/http";
import type { AIProviderAdapter, GenerateRequest, GenerateResult, StreamEvent } from "@/lib/ai/types";

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AIError("cancelled", "Mock request was cancelled.", false));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function lastUserText(request: GenerateRequest) {
  return [...request.messages].reverse().find((item) => item.role === "user")?.content ?? "";
}

function sourcesFromMessages(messages: GenerateRequest["messages"]) {
  const system = messages.find((item) => item.role === "system")?.content ?? "";
  const match = system.match(/Sources:\n([\s\S]+)$/);
  return match?.[1]?.trim() ?? "";
}

export function mockReplyFor(userText: string, messages: GenerateRequest["messages"] = []) {
  const normalized = userText.toLowerCase();
  if (normalized.includes("__timeout__")) {
    throw new AIError("timeout", "Mock timed out.", true);
  }
  if (normalized.includes("__fail__")) {
    throw new AIError("provider_error", "Mock provider failed.", true);
  }
  if (normalized.includes("__auth__")) {
    throw new AIError("invalid_credentials", "Mock rejected the API key.", false, 401);
  }
  const sources = sourcesFromMessages(messages);
  if (sources) {
    const first = sources.split(/\n\n/)[0]?.replace(/^\[\d+\]\s*/, "").trim() ?? sources;
    return `Based on the knowledge base: ${first.slice(0, 320)}`;
  }
  if (normalized.includes("hours") || normalized.includes("open")) {
    return "We are open 10:00–19:00 on weekdays and 11:00–17:00 on weekends.";
  }
  if (normalized.includes("return") || normalized.includes("refund")) {
    return "Unopened items can be returned within 30 days with a receipt.";
  }
  return `I received your question: "${userText.slice(0, 240)}". This is a deterministic mock reply used in tests and AI_MOCK_MODE.`;
}

export const mockAdapter: AIProviderAdapter = {
  id: "mock",
  async generate(request) {
    const userText = lastUserText(request);
    const text = mockReplyFor(userText, request.messages);
    return {
      text,
      usage: {
        inputTokens: estimateTokens(userText),
        outputTokens: estimateTokens(text),
        source: "provider",
      },
      provider: "mock",
      model: request.model,
      finishReason: "stop",
    } satisfies GenerateResult;
  },
  async *stream(request): AsyncIterable<StreamEvent> {
    const userText = lastUserText(request);
    const text = mockReplyFor(userText, request.messages);
    const parts = text.match(/.{1,24}/g) ?? [text];
    for (const part of parts) {
      await delay(5, request.abortSignal);
      yield { type: "delta", text: part };
    }
    yield {
      type: "usage",
      usage: {
        inputTokens: estimateTokens(userText),
        outputTokens: estimateTokens(text),
        source: "provider",
      },
    };
    yield { type: "done", finishReason: "stop" };
  },
  async embed(input) {
    return {
      vectors: input.map((value) => {
        const vector = new Array(8).fill(0);
        for (let i = 0; i < value.length; i += 1) {
          vector[i % 8] += value.charCodeAt(i) / 255;
        }
        return vector;
      }),
      usage: { inputTokens: estimateTokens(input.join("")), outputTokens: 0, source: "estimated" },
    };
  },
};
