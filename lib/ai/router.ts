import { AIError, normalizeUnknownError } from "@/lib/ai/errors";
import { anthropicAdapter } from "@/lib/ai/adapters/anthropic";
import { geminiAdapter } from "@/lib/ai/adapters/gemini";
import { mockAdapter } from "@/lib/ai/adapters/mock";
import { openaiAdapter } from "@/lib/ai/adapters/openai";
import { capOutputTokens, getModelDefinition } from "@/lib/ai/models";
import { isAiMockMode } from "@/lib/ai/mode";
import type { AIProviderAdapter, GenerateRequest, GenerateResult, ProviderId, StreamEvent } from "@/lib/ai/types";

const ADAPTERS: Record<ProviderId, AIProviderAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  anthropic: anthropicAdapter,
  mock: mockAdapter,
};

export function getAdapter(provider: ProviderId): AIProviderAdapter {
  if (isAiMockMode()) return mockAdapter;
  return ADAPTERS[provider];
}

export function assertModelSupported(provider: ProviderId, model: string) {
  if (isAiMockMode()) return;
  if (!getModelDefinition(provider, model)) {
    throw new AIError("unsupported", `${provider} model "${model}" is not in the ChatPilot catalog.`, false);
  }
}

function withCaps(request: GenerateRequest): GenerateRequest {
  return {
    ...request,
    maxOutputTokens: capOutputTokens(request.provider, request.model, request.maxOutputTokens),
    timeoutMs: request.timeoutMs ?? 35_000,
  };
}

export async function generateText(request: GenerateRequest): Promise<GenerateResult> {
  const prepared = withCaps(request);
  assertModelSupported(prepared.provider, prepared.model);
  try {
    return await getAdapter(prepared.provider).generate(prepared);
  } catch (error) {
    throw normalizeUnknownError(error, prepared.provider);
  }
}

export async function* streamText(request: GenerateRequest): AsyncIterable<StreamEvent> {
  const prepared = withCaps(request);
  assertModelSupported(prepared.provider, prepared.model);
  const adapter = getAdapter(prepared.provider);
  const capabilities = getModelDefinition(prepared.provider, prepared.model)?.capabilities;
  if (capabilities && !capabilities.streaming && !isAiMockMode()) {
    const result = await adapter.generate(prepared);
    yield { type: "delta", text: result.text };
    yield { type: "usage", usage: result.usage };
    yield { type: "done", finishReason: result.finishReason };
    return;
  }
  try {
    yield* adapter.stream(prepared);
  } catch (error) {
    throw normalizeUnknownError(error, prepared.provider);
  }
}

export async function generateWithFallback(input: {
  primary: GenerateRequest;
  fallback?: GenerateRequest | null;
}): Promise<GenerateResult> {
  try {
    return await generateText(input.primary);
  } catch (error) {
    const aiError = normalizeUnknownError(error, input.primary.provider);
    if (!input.fallback || aiError.code === "cancelled") throw aiError;
    try {
      return await generateText(input.fallback);
    } catch (fallbackError) {
      throw normalizeUnknownError(fallbackError, input.fallback.provider);
    }
  }
}
