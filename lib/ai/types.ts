export const PROVIDER_IDS = ["openai", "gemini", "anthropic", "mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ModelCapabilities = {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  embeddings: boolean;
  maxOutputTokens: number;
};

export type ModelDefinition = {
  id: string;
  provider: ProviderId;
  label: string;
  capabilities: ModelCapabilities;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  source: "provider" | "estimated";
};

export type GenerateRequest = {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  apiKey: string;
};

export type GenerateResult = {
  text: string;
  usage: TokenUsage;
  provider: ProviderId;
  model: string;
  finishReason: string;
};

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: string };

export interface AIProviderAdapter {
  id: ProviderId;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  stream(request: GenerateRequest): AsyncIterable<StreamEvent>;
  embed?(input: string[], apiKey: string): Promise<{ vectors: number[][]; usage: TokenUsage }>;
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}
