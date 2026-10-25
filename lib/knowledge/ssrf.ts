import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfError extends Error {
  constructor(message = "That URL is not allowed.") {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
]);

function ipToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr(ip: string, cidr: string) {
  const [base, bitsRaw] = cidr.split("/");
  if (!base || !bitsRaw || isIP(ip) !== 4 || isIP(base) !== 4) return false;
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

export function isBlockedIp(address: string) {
  if (address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) {
    return true;
  }
  if (address.includes(":")) {
    const mapped = address.toLowerCase().match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isBlockedIp(mapped[1]);
    return address === "0:0:0:0:0:0:0:1";
  }
  return [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
  ].some((cidr) => inCidr(address, cidr));
}

export function parsePublicHttpUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SsrfError("Enter a valid http or https URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError("Only http and https URLs are allowed.");
  }
  if (parsed.username || parsed.password) {
    throw new SsrfError("URLs with credentials are not allowed.");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    throw new SsrfError("That host is not allowed.");
  }
  if (isIP(hostname) && isBlockedIp(hostname)) {
    throw new SsrfError("Private or link-local addresses are not allowed.");
  }
  return parsed;
}

export async function resolvePublicHostname(hostname: string) {
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SsrfError("Private or link-local addresses are not allowed.");
    return [hostname];
  }
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfError("The hostname could not be resolved.");
  }
  if (!records.length) throw new SsrfError("The hostname could not be resolved.");
  const addresses = records.map((item) => item.address);
  if (addresses.some(isBlockedIp)) {
    throw new SsrfError("That host resolves to a private address.");
  }
  return addresses;
}

export async function assertPublicHttpUrl(raw: string) {
  const parsed = parsePublicHttpUrl(raw);
  await resolvePublicHostname(parsed.hostname.replace(/^\[|\]$/g, ""));
  return parsed;
}
