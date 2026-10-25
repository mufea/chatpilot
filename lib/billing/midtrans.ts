import { createHash, timingSafeEqual } from "node:crypto";
import { BillingError } from "@/lib/billing/errors";

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id?: string;
  fraud_status?: string;
};

function midtransServerKey() {
  return process.env.MIDTRANS_SERVER_KEY?.trim() || "";
}

export function isMidtransConfigured() {
  return Boolean(midtransServerKey());
}

export function midtransApiOrigin() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export function verifyMidtransSignature(
  payload: MidtransNotification,
  serverKey = midtransServerKey(),
) {
  if (!serverKey) {
    throw new BillingError("Midtrans is not configured on this server.", 503, "not_configured");
  }
  const raw = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  const expected = createHash("sha512").update(raw).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(payload.signature_key || "", "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new BillingError("Invalid Midtrans signature.", 400, "invalid_signature");
  }
}

export function signMidtransNotification(
  payload: Omit<MidtransNotification, "signature_key">,
  serverKey: string,
) {
  return createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest("hex");
}

export function midtransSuccess(status: string, fraud?: string) {
  if (status === "settlement") return true;
  return status === "capture" && (fraud === "accept" || !fraud);
}

export function midtransFailure(status: string) {
  return status === "deny" || status === "expire" || status === "cancel" || status === "failure";
}

export async function createMidtransSnap(input: {
  orderId: string;
  amountCents: number;
  planName: string;
  customerEmail?: string;
  organizationId: string;
  planCode: string;
  fetchImpl?: typeof fetch;
}) {
  const key = midtransServerKey();
  if (!key) {
    throw new BillingError("Midtrans is not configured on this server.", 503, "not_configured");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${midtransApiOrigin()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: Math.round(input.amountCents / 100),
      },
      item_details: [{ id: input.planCode, name: input.planName, price: Math.round(input.amountCents / 100), quantity: 1 }],
      customer_details: input.customerEmail ? { email: input.customerEmail } : undefined,
      custom_field1: input.organizationId,
      custom_field2: input.planCode,
    }),
  });
  const json = (await response.json()) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!response.ok || !json.redirect_url) {
    throw new BillingError(json.error_messages?.join(" ") || "Midtrans checkout could not be created.", 502, "provider_error");
  }
  return { token: json.token ?? "", redirectUrl: json.redirect_url };
}
