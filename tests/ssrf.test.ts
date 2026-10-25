import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlockedIp, parsePublicHttpUrl, SsrfError } from "../lib/knowledge/ssrf";
import { chunkText } from "../lib/knowledge/chunk";
import { extractCsv, extractFaq, extractFromBuffer, htmlToText } from "../lib/knowledge/extract";
import { sitemapLocs } from "../lib/knowledge/crawl";

test("blocks private, loopback, and metadata addresses", () => {
  assert.equal(isBlockedIp("127.0.0.1"), true);
  assert.equal(isBlockedIp("10.1.2.3"), true);
  assert.equal(isBlockedIp("192.168.1.9"), true);
  assert.equal(isBlockedIp("169.254.169.254"), true);
  assert.equal(isBlockedIp("172.16.5.1"), true);
  assert.equal(isBlockedIp("8.8.8.8"), false);
});

test("rejects unsafe URL shapes before any network call", () => {
  assert.throws(() => parsePublicHttpUrl("file:///etc/passwd"), SsrfError);
  assert.throws(() => parsePublicHttpUrl("http://localhost/admin"), SsrfError);
  assert.throws(() => parsePublicHttpUrl("http://127.0.0.1/"), SsrfError);
  assert.throws(() => parsePublicHttpUrl("http://169.254.169.254/latest/meta-data"), SsrfError);
  assert.throws(() => parsePublicHttpUrl("http://10.0.0.4/internal"), SsrfError);
  assert.throws(() => parsePublicHttpUrl("http://user:pass@example.com"), SsrfError);
  const ok = parsePublicHttpUrl("https://example.com/help");
  assert.equal(ok.hostname, "example.com");
});

test("extracts text, FAQ, CSV, and HTML", async () => {
  const txt = await extractFromBuffer(Buffer.from("Harbor Books is open 09:00–18:00."), "TXT");
  assert.match(txt, /Harbor Books/);
  assert.match(extractFaq("Q: Hours?\nA: 09:00–18:00\n"), /Question: Hours/);
  assert.match(extractCsv("day,hours\nMon,09-18"), /Mon — 09-18/);
  assert.match(htmlToText("<html><script>steal()</script><p>Returns in 14 days</p></html>"), /Returns in 14 days/);
  assert.doesNotMatch(htmlToText("<script>steal()</script><p>Safe</p>"), /steal/);
});

test("chunks long text with overlap and keeps short text as one chunk", () => {
  const short = chunkText("Short policy.");
  assert.equal(short.length, 1);
  const long = chunkText("alpha ".repeat(400), 80, 10);
  assert.ok(long.length > 1);
  assert.ok(long.every((item) => item.content.length > 0));
});

test("sitemap locs stay on the same origin", () => {
  const xml = `
    <urlset>
      <loc>https://example.com/a</loc>
      <loc>https://evil.test/b</loc>
      <loc>https://example.com/c</loc>
    </urlset>
  `;
  const locs = sitemapLocs(xml, "https://example.com/sitemap.xml");
  assert.deepEqual(locs, ["https://example.com/a", "https://example.com/c"]);
});
