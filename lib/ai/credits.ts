import type { PrismaClient } from "@prisma/client";
import type { TokenUsage } from "@/lib/ai/types";

export class CreditError extends Error {
  constructor(message = "This workspace does not have enough AI credits.") {
    super(message);
    this.name = "CreditError";
  }
}

export function creditsFromUsage(usage: TokenUsage) {
  const tokens = Math.max(0, usage.inputTokens) + Math.max(0, usage.outputTokens);
  return Math.max(1, Math.ceil(tokens / 1000));
}

export function estimatedCostMicros(provider: string, usage: TokenUsage) {
  const inputRate = provider === "anthropic" ? 3 : provider === "gemini" ? 1 : 2;
  const outputRate = provider === "anthropic" ? 15 : provider === "gemini" ? 4 : 8;
  return usage.inputTokens * inputRate + usage.outputTokens * outputRate;
}

export async function reserveCredits(
  db: PrismaClient,
  organizationId: string,
  requestId: string,
  amount = 1,
) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
      SELECT id, balance FROM "CreditAccount" WHERE "organizationId" = ${organizationId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account || account.balance < amount) {
      throw new CreditError();
    }
    const next = account.balance - amount;
    await tx.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: next,
        lifetimeUsed: { increment: amount },
      },
    });
    await tx.creditLedgerEntry.create({
      data: {
        creditAccountId: account.id,
        type: "USAGE",
        amount: -amount,
        balanceAfter: next,
        reason: "AI request reservation",
        idempotencyKey: `reserve:${requestId}`,
      },
    });
    return { accountId: account.id, reserved: amount, balanceAfter: next };
  });
}

export async function settleCredits(
  db: PrismaClient,
  input: {
    organizationId: string;
    accountId: string;
    requestId: string;
    reserved: number;
    actual: number;
    usage: TokenUsage;
    provider: string;
    model: string;
    chatbotId?: string;
  },
) {
  const delta = input.actual - input.reserved;
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
      SELECT id, balance FROM "CreditAccount" WHERE id = ${input.accountId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account) return;
    let balance = account.balance;
    if (delta > 0) {
      if (balance < delta) {
        throw new CreditError();
      }
      balance -= delta;
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance, lifetimeUsed: { increment: delta } },
      });
      await tx.creditLedgerEntry.create({
        data: {
          creditAccountId: account.id,
          type: "USAGE",
          amount: -delta,
          balanceAfter: balance,
          reason: "AI usage settlement",
          idempotencyKey: `settle:${input.requestId}`,
          usageRecordId: undefined,
        },
      });
    } else if (delta < 0) {
      const refund = Math.abs(delta);
      balance += refund;
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance, lifetimeUsed: { decrement: refund } },
      });
      await tx.creditLedgerEntry.create({
        data: {
          creditAccountId: account.id,
          type: "REFUND",
          amount: refund,
          balanceAfter: balance,
          reason: "Unused reservation",
          idempotencyKey: `refund:${input.requestId}`,
        },
      });
    }

    await tx.usageRecord.create({
      data: {
        organizationId: input.organizationId,
        chatbotId: input.chatbotId,
        provider: input.provider,
        model: input.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        credits: input.actual,
        estimatedCostMicros: estimatedCostMicros(input.provider, input.usage),
        requestId: input.requestId,
      },
    });
  });
}

export async function refundReservation(
  db: PrismaClient,
  accountId: string,
  requestId: string,
  amount: number,
) {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
      SELECT id, balance FROM "CreditAccount" WHERE id = ${accountId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account) return;
    const balance = account.balance + amount;
    await tx.creditAccount.update({
      where: { id: account.id },
      data: { balance, lifetimeUsed: { decrement: amount } },
    });
    await tx.creditLedgerEntry.create({
      data: {
        creditAccountId: account.id,
        type: "REFUND",
        amount,
        balanceAfter: balance,
        reason: "Failed AI request",
        idempotencyKey: `failrefund:${requestId}`,
      },
    });
  });
}
