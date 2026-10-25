import { AIError, normalizeHttpError, normalizeUnknownError } from "@/lib/ai/errors";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  abortSignal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw normalizeUnknownError(error, new URL(url).host);
  } finally {
    clearTimeout(timer);
    abortSignal?.removeEventListener("abort", onAbort);
  }
}

export async function readErrorBody(response: Response, provider: string): Promise<AIError> {
  const body = await response.text().catch(() => "");
  return normalizeHttpError(provider, response.status, body);
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function* iterateSse(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AIError("provider_error", "Provider returned an empty stream.", false, response.status);
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const dataLines = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      yield dataLines.join("\n");
    }
  }
  if (buffer.trim()) {
    const leftover = buffer
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (leftover) yield leftover;
  }
}
