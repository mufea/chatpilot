import { createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "@/lib/billing/errors";

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

export function isStripeConfigured() {
  return Boolean(stripeSecret());
}

export function isStripeWebhookConfigured() {
  return Boolean(stripeWebhookSecret());
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret = stripeWebhookSecret(),
  now = Date.now(),
): StripeEvent {
  if (!secret) {
    throw new BillingError("Stripe webhooks are not configured on this server.", 503, "not_configured");
  }
  if (!header) {
    throw new BillingError("Missing Stripe-Signature header.", 400, "invalid_signature");
  }
  const items = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = items.find(([key]) => key === "t")?.[1];
  const signatures = items.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) {
    throw new BillingError("Invalid Stripe-Signature header.", 400, "invalid_signature");
  }
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) {
    throw new BillingError("Stripe signature timestamp is too old.", 400, "invalid_signature");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const matched = signatures.some((signature) => {
    const given = Buffer.from(signature ?? "", "hex");
    return given.length === expectedBuf.length && timingSafeEqual(given, expectedBuf);
  });
  if (!matched) {
    throw new BillingError("Invalid Stripe signature.", 400, "invalid_signature");
  }
  return JSON.parse(rawBody) as StripeEvent;
}

export function signStripePayload(rawBody: string, secret: string, timestamp: number) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export async function createStripeCheckoutSession(input: {
  organizationId: string;
  planCode: string;
  planName: string;
  interval: "MONTHLY" | "YEARLY";
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  stripePriceId?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const key = stripeSecret();
  if (!key) {
    throw new BillingError("Stripe is not configured on this server.", 503, "not_configured");
  }
  const body = new URLSearchParams({
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.organizationId,
    "metadata[organizationId]": input.organizationId,
    "metadata[planCode]": input.planCode,
    "metadata[interval]": input.interval,
    "subscription_data[metadata][organizationId]": input.organizationId,
    "subscription_data[metadata][planCode]": input.planCode,
  });
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  if (input.stripePriceId) {
    body.set("line_items[0][price]", input.stripePriceId);
    body.set("line_items[0][quantity]", "1");
  } else {
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][product_data][name]", `ChatPilot ${input.planName}`);
    body.set(
      "line_items[0][price_data][recurring][interval]",
      input.interval === "YEARLY" ? "year" : "month",
    );
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await response.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.url) {
    throw new BillingError(json.error?.message || "Stripe checkout could not be created.", 502, "provider_error");
  }
  return { id: json.id ?? "", url: json.url };
}
