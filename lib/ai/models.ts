import type { ModelDefinition, ProviderId } from "@/lib/ai/types";

const STREAMING_TEXT = {
  streaming: true,
  tools: false,
  vision: false,
  embeddings: false,
  maxOutputTokens: 8192,
};

export const MODEL_CATALOG: ModelDefinition[] = [
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 mini",
    capabilities: { ...STREAMING_TEXT, tools: true, maxOutputTokens: 32768 },
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 32768 },
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o mini",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 16384 },
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 65536 },
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 65536 },
  },
  {
    id: "gemini-2.0-flash",
    provider: "gemini",
    label: "Gemini 2.0 Flash",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 8192 },
  },
  {
    id: "claude-sonnet-4-5",
    provider: "anthropic",
    label: "Claude Sonnet 4.5",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 64000 },
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    capabilities: { ...STREAMING_TEXT, tools: true, maxOutputTokens: 64000 },
  },
  {
    id: "claude-opus-4-1",
    provider: "anthropic",
    label: "Claude Opus 4.1",
    capabilities: { ...STREAMING_TEXT, tools: true, vision: true, maxOutputTokens: 32000 },
  },
  {
    id: "mock-chat",
    provider: "mock",
    label: "Mock chat (tests / AI_MOCK_MODE)",
    capabilities: { ...STREAMING_TEXT, embeddings: true, maxOutputTokens: 1024 },
  },
];

export function modelsFor(provider: ProviderId) {
  return MODEL_CATALOG.filter((model) => model.provider === provider);
}

export function getModelDefinition(provider: ProviderId, model: string) {
  return MODEL_CATALOG.find((item) => item.provider === provider && item.id === model) ?? null;
}

export function defaultModelFor(provider: ProviderId) {
  return modelsFor(provider)[0]?.id ?? "mock-chat";
}

export function capOutputTokens(provider: ProviderId, model: string, requested?: number) {
  const definition = getModelDefinition(provider, model);
  const max = definition?.capabilities.maxOutputTokens ?? 2048;
  const value = requested ?? 512;
  return Math.min(Math.max(16, value), max);
}
