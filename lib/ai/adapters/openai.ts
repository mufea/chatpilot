import { AIError } from "@/lib/ai/errors";
import { estimateTokens, fetchWithTimeout, iterateSse, readErrorBody } from "@/lib/ai/http";
import type { AIProviderAdapter, ChatMessage, GenerateRequest, StreamEvent, TokenUsage } from "@/lib/ai/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function payload(request: GenerateRequest, stream: boolean) {
  return {
    model: request.model,
    messages: toOpenAIMessages(request.messages),
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxOutputTokens ?? 512,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

export const openaiAdapter: AIProviderAdapter = {
  id: "openai",
  async generate(request) {
    const response = await fetchWithTimeout(
      OPENAI_URL,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload(request, false)),
      },
      request.timeoutMs ?? 30_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "OpenAI");
    const json = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return {
      text,
      usage: usageFromOpenAI(json.usage, request, text),
      provider: "openai",
      model: request.model,
      finishReason: json.choices?.[0]?.finish_reason ?? "stop",
    };
  },
  async *stream(request): AsyncIterable<StreamEvent> {
    const response = await fetchWithTimeout(
      OPENAI_URL,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload(request, true)),
      },
      request.timeoutMs ?? 45_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "OpenAI");

    let text = "";
    let usage: TokenUsage | null = null;
    let finishReason = "stop";
    for await (const data of iterateSse(response)) {
      if (data === "[DONE]") break;
      const json = JSON.parse(data) as {
        choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        yield { type: "delta", text: delta };
      }
      if (json.choices?.[0]?.finish_reason) {
        finishReason = json.choices[0].finish_reason;
      }
      if (json.usage) {
        usage = usageFromOpenAI(json.usage, request, text);
      }
    }
    yield { type: "usage", usage: usage ?? usageFromOpenAI(undefined, request, text) };
    yield { type: "done", finishReason };
  },
  async embed(input, apiKey) {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input }),
      },
      30_000,
    );
    if (!response.ok) throw await readErrorBody(response, "OpenAI");
    const json = (await response.json()) as {
      data?: { embedding: number[] }[];
      usage?: { prompt_tokens?: number };
    };
    if (!json.data?.length) {
      throw new AIError("provider_error", "OpenAI returned no embeddings.", false);
    }
    return {
      vectors: json.data.map((item) => item.embedding),
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? estimateTokens(input.join("")),
        outputTokens: 0,
        source: json.usage?.prompt_tokens != null ? "provider" : "estimated",
      },
    };
  },
};

function usageFromOpenAI(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  request: GenerateRequest,
  output: string,
): TokenUsage {
  if (usage?.prompt_tokens != null || usage?.completion_tokens != null) {
    return {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      source: "provider",
    };
  }
  return {
    inputTokens: estimateTokens(request.messages.map((item) => item.content).join("\n")),
    outputTokens: estimateTokens(output),
    source: "estimated",
  };
}
