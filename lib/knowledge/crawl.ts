import { MAX_FETCH_BYTES, MAX_SITEMAP_PAGES } from "@/lib/knowledge/constants";
import { htmlToText } from "@/lib/knowledge/extract";
import { assertPublicHttpUrl, parsePublicHttpUrl, resolvePublicHostname, SsrfError } from "@/lib/knowledge/ssrf";

export type FetchImpl = typeof fetch;

async function readLimited(response: Response, maxBytes = MAX_FETCH_BYTES) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.from(await response.arrayBuffer());
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new SsrfError("The remote document is larger than the allowed size.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function safeFetch(
  rawUrl: string,
  input: { fetchImpl?: FetchImpl; timeoutMs?: number; accept?: string } = {},
) {
  const fetchImpl = input.fetchImpl ?? fetch;
  let current = (await assertPublicHttpUrl(rawUrl)).toString();
  for (let hop = 0; hop < 5; hop += 1) {
    const parsed = parsePublicHttpUrl(current);
    await resolvePublicHostname(parsed.hostname.replace(/^\[|\]$/g, ""));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 10_000);
    let response: Response;
    try {
      response = await fetchImpl(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: input.accept ?? "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5",
          "user-agent": "ChatPilotBot/1.0",
        },
      });
    } catch (error) {
      if (error instanceof SsrfError) throw error;
      throw new SsrfError("The remote host could not be reached.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new SsrfError("The remote host returned an empty redirect.");
      current = new URL(location, parsed).toString();
      continue;
    }
    if (!response.ok) {
      throw new SsrfError(`The remote host returned ${response.status}.`);
    }
    const buffer = await readLimited(response);
    const contentType = response.headers.get("content-type") ?? "text/html";
    return { url: parsed.toString(), buffer, contentType };
  }
  throw new SsrfError("Too many redirects.");
}

export async function fetchPageText(url: string, fetchImpl?: FetchImpl) {
  const result = await safeFetch(url, { fetchImpl });
  const body = result.buffer.toString("utf8");
  const text = result.contentType.includes("html") ? htmlToText(body) : body.replace(/\u0000/g, "").trim();
  if (!text) throw new SsrfError("The page did not contain extractable text.");
  return { url: result.url, title: titleFromHtml(body) ?? result.url, text };
}

function titleFromHtml(html: string) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim().slice(0, 160) ?? null;
}

function sameOrigin(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol === b.protocol && a.hostname === b.hostname;
  } catch {
    return false;
  }
}

export function sitemapLocs(xml: string, origin: string) {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1]!.trim());
  return [...new Set(locs.filter((loc) => sameOrigin(origin, loc)))].slice(0, MAX_SITEMAP_PAGES);
}

export async function crawlSitemap(url: string, fetchImpl?: FetchImpl) {
  const sitemap = await safeFetch(url, { fetchImpl, accept: "application/xml,text/xml,text/plain" });
  const locs = sitemapLocs(sitemap.buffer.toString("utf8"), sitemap.url);
  if (!locs.length) throw new SsrfError("The sitemap did not contain same-origin URLs.");
  const pages: { url: string; title: string; text: string }[] = [];
  for (const loc of locs) {
    try {
      pages.push(await fetchPageText(loc, fetchImpl));
    } catch {
      // Skip pages that fail after the sitemap itself passed SSRF checks.
    }
  }
  if (!pages.length) throw new SsrfError("None of the sitemap pages could be fetched.");
  const text = pages.map((page) => `# ${page.title}\nSource: ${page.url}\n\n${page.text}`).join("\n\n");
  return { url: sitemap.url, title: `Sitemap ${new URL(sitemap.url).hostname}`, text, pages: pages.length };
}
