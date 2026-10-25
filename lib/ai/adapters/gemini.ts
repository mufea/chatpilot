import { estimateTokens, fetchWithTimeout, iterateSse, readErrorBody } from "@/lib/ai/http";
import type { AIProviderAdapter, ChatMessage, GenerateRequest, StreamEvent, TokenUsage } from "@/lib/ai/types";

function toGeminiContents(messages: ChatMessage[]) {
  const system = messages.filter((item) => item.role === "system").map((item) => item.content).join("\n\n");
  const contents = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));
  return { system, contents };
}

function geminiUrl(model: string, stream: boolean, apiKey: string) {
  const method = stream ? "streamGenerateContent" : "generateContent";
  const query = stream ? `?alt=sse&key=${encodeURIComponent(apiKey)}` : `?key=${encodeURIComponent(apiKey)}`;
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}${query}`;
}

function bodyFor(request: GenerateRequest, system: string, contents: unknown) {
  return {
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    generationConfig: {
      temperature: request.temperature ?? 0.4,
      maxOutputTokens: request.maxOutputTokens ?? 512,
    },
  };
}

export const geminiAdapter: AIProviderAdapter = {
  id: "gemini",
  async generate(request) {
    const { system, contents } = toGeminiContents(request.messages);
    const response = await fetchWithTimeout(
      geminiUrl(request.model, false, request.apiKey),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bodyFor(request, system, contents)),
      },
      request.timeoutMs ?? 30_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "Gemini");
    const json = (await response.json()) as GeminiResponse;
    const text = collectText(json);
    return {
      text,
      usage: usageFromGemini(json.usageMetadata, request, text),
      provider: "gemini",
      model: request.model,
      finishReason: json.candidates?.[0]?.finishReason ?? "STOP",
    };
  },
  async *stream(request): AsyncIterable<StreamEvent> {
    const { system, contents } = toGeminiContents(request.messages);
    const response = await fetchWithTimeout(
      geminiUrl(request.model, true, request.apiKey),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bodyFor(request, system, contents)),
      },
      request.timeoutMs ?? 45_000,
      request.abortSignal,
    );
    if (!response.ok) throw await readErrorBody(response, "Gemini");

    let text = "";
    let usage: TokenUsage | null = null;
    let finishReason = "STOP";
    for await (const data of iterateSse(response)) {
      const json = JSON.parse(data) as GeminiResponse;
      const delta = collectText(json);
      if (delta) {
        text += delta;
        yield { type: "delta", text: delta };
      }
      if (json.candidates?.[0]?.finishReason) {
        finishReason = json.candidates[0].finishReason;
      }
      if (json.usageMetadata) {
        usage = usageFromGemini(json.usageMetadata, request, text);
      }
    }
    yield { type: "usage", usage: usage ?? usageFromGemini(undefined, request, text) };
    yield { type: "done", finishReason };
  },
  async embed(input, apiKey) {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: input.map((text) => ({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
          })),
        }),
      },
      30_000,
    );
    if (!response.ok) throw await readErrorBody(response, "Gemini");
    const json = (await response.json()) as { embeddings?: { values?: number[] }[] };
    if (!json.embeddings?.length) {
      throw new Error("Gemini returned no embeddings.");
    }
    return {
      vectors: json.embeddings.map((item) => item.values ?? []),
      usage: {
        inputTokens: estimateTokens(input.join("")),
        outputTokens: 0,
        source: "estimated",
      },
    };
  },
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

function collectText(json: GeminiResponse) {
  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function usageFromGemini(
  usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
  request: GenerateRequest,
  output: string,
): TokenUsage {
  if (usage?.promptTokenCount != null || usage?.candidatesTokenCount != null) {
    return {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      source: "provider",
    };
  }
  return {
    inputTokens: estimateTokens(request.messages.map((item) => item.content).join("\n")),
    outputTokens: estimateTokens(output),
    source: "estimated",
  };
}
