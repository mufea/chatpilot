const DEFAULT_PORTS = new Set(["80", "443"]);

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

export function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")?.trim();
  if (origin) return origin;
  const referer = request.headers.get("referer")?.trim();
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function hostFromOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const port = url.port;
    if (!port || DEFAULT_PORTS.has(port)) {
      return url.hostname.toLowerCase();
    }
    return `${url.hostname.toLowerCase()}:${port}`;
  } catch {
    return null;
  }
}

export function normalizeAllowedDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    if (trimmed.includes("://")) {
      return hostFromOrigin(trimmed);
    }
    const url = new URL(`http://${trimmed}`);
    const port = url.port;
    if (!port || DEFAULT_PORTS.has(port)) {
      return url.hostname.toLowerCase();
    }
    return `${url.hostname.toLowerCase()}:${port}`;
  } catch {
    return null;
  }
}

export function originAllowed(origin: string | null, allowedDomains: string[]): boolean {
  const host = hostFromOrigin(origin);
  if (!host) return false;
  const allow = allowedDomains
    .map((item) => normalizeAllowedDomain(item))
    .filter((item): item is string => Boolean(item));
  if (!allow.length) return false;
  return allow.includes(host);
}

export function widgetPublicId(request: Request, bodyPublicId?: string): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("publicId")?.trim();
  const fromHeader = request.headers.get("x-chatpilot-public-id")?.trim();
  return fromQuery || bodyPublicId?.trim() || fromHeader || null;
}
