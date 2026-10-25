export type AIErrorCode =
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited"
  | "timeout"
  | "cancelled"
  | "network"
  | "invalid_request"
  | "unsupported"
  | "provider_error"
  | "content_filtered";

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public retryable = false,
    public status?: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function normalizeHttpError(provider: string, status: number, body: string): AIError {
  const snippet = body.replace(/\s+/g, " ").slice(0, 180);
  if (status === 401 || status === 403) {
    return new AIError("invalid_credentials", `${provider} rejected the API key.`, false, status);
  }
  if (status === 429) {
    return new AIError("rate_limited", `${provider} rate-limited the request.`, true, status);
  }
  if (status === 408) {
    return new AIError("timeout", `${provider} timed out.`, true, status);
  }
  if (status === 400) {
    return new AIError("invalid_request", `${provider} rejected the request. ${snippet}`.trim(), false, status);
  }
  if (status >= 500) {
    return new AIError("provider_error", `${provider} returned ${status}.`, true, status);
  }
  return new AIError("provider_error", `${provider} returned ${status}. ${snippet}`.trim(), isRetryableStatus(status), status);
}

export function normalizeUnknownError(error: unknown, provider: string): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIError("cancelled", `${provider} request was cancelled.`, false);
  }
  if (error instanceof Error && /aborted|abort/i.test(error.message)) {
    return new AIError("cancelled", `${provider} request was cancelled.`, false);
  }
  if (error instanceof Error && /timeout/i.test(error.message)) {
    return new AIError("timeout", `${provider} request timed out.`, true);
  }
  if (error instanceof TypeError) {
    return new AIError("network", `Network error talking to ${provider}.`, true);
  }
  return new AIError("provider_error", `${provider} failed unexpectedly.`, false);
}
