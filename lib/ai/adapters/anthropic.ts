import { estimateTokens, fetchWithTimeout, iterateSse, readErrorBody } from "@/lib/ai/http";
import type { AIProviderAdapter, ChatMessage, GenerateRequest, StreamEvent, TokenUsage } from "@/lib/ai/types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function splitMessages(messages: ChatMessage[]) {
  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
  const rest = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));
  return { system, rest };
}

function headers(apiKey: string) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

export const anthropicAdapter: AIProviderAdapter = {
  id: "anthropic",
  async generate(request) {
    const { system, rest } = splitMessages(request.messages);
    const response = await fetchWithTimeout(
      ANTHROPIC_URL,
      {
        method: "POST",
        headers: headers(request.apiKey),
        body: JSON.stringify({
          model: request.model,
          system: system || undefined,
          messages: rest,
          max_tokens: request.maxOutputTokens ?? 512,
          temperature: request.temperature ?? 0.4,
        }),
      },
      request.timeoutMs ?? 30_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "Anthropic");
    const json = (await response.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = json.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("") ?? "";
    return {
      text,
      usage: usageFromAnthropic(json.usage, request, text),
      provider: "anthropic",
      model: request.model,
      finishReason: json.stop_reason ?? "end_turn",
    };
  },
  async *stream(request): AsyncIterable<StreamEvent> {
    const { system, rest } = splitMessages(request.messages);
    const response = await fetchWithTimeout(
      ANTHROPIC_URL,
      {
        method: "POST",
        headers: headers(request.apiKey),
        body: JSON.stringify({
          model: request.model,
          system: system || undefined,
          messages: rest,
          max_tokens: request.maxOutputTokens ?? 512,
          temperature: request.temperature ?? 0.4,
          stream: true,
        }),
      },
      request.timeoutMs ?? 45_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "Anthropic");

    let text = "";
    let usage: TokenUsage | null = null;
    let finishReason = "end_turn";
    for await (const data of iterateSse(response)) {
      const json = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string; stop_reason?: string };
        usage?: { input_tokens?: number; output_tokens?: number };
        message?: { usage?: { input_tokens?: number; output_tokens?: number } };
      };
      if (json.type === "content_block_delta" && json.delta?.text) {
        text += json.delta.text;
        yield { type: "delta", text: json.delta.text };
      }
      if (json.type === "message_delta") {
        if (json.delta?.stop_reason) finishReason = json.delta.stop_reason;
        if (json.usage) usage = usageFromAnthropic(json.usage, request, text);
      }
      if (json.type === "message_start" && json.message?.usage) {
        usage = usageFromAnthropic(json.message.usage, request, text);
      }
    }
    yield { type: "usage", usage: usage ?? usageFromAnthropic(undefined, request, text) };
    yield { type: "done", finishReason };
  },
};

function usageFromAnthropic(
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
  request: GenerateRequest,
  output: string,
): TokenUsage {
  if (usage?.input_tokens != null || usage?.output_tokens != null) {
    return {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      source: usage.input_tokens != null || usage.output_tokens != null ? "provider" : "estimated",
    };
  }
  return {
    inputTokens: estimateTokens(request.messages.map((item) => item.content).join("\n")),
    outputTokens: estimateTokens(output),
    source: "estimated",
  };
}
