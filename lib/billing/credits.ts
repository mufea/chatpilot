import { CreditLedgerType, Prisma, type PrismaClient } from "@prisma/client";
import { BillingError } from "@/lib/billing/errors";

export async function grantCredits(
  db: PrismaClient,
  input: {
    organizationId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    type?: CreditLedgerType;
    actorUserId?: string;
  },
) {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new BillingError("Credit amount must be a non-zero integer.");
  }
  const type = input.type ?? (input.amount > 0 ? CreditLedgerType.GRANT : CreditLedgerType.ADJUSTMENT);

  return db.$transaction(async (tx) => {
    const existing = await tx.creditLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { duplicate: true, balanceAfter: existing.balanceAfter, entryId: existing.id };
    }

    const rows = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
      SELECT id, balance FROM "CreditAccount" WHERE "organizationId" = ${input.organizationId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account) {
      throw new BillingError("Credit account not found.", 404, "not_found");
    }
    const next = account.balance + input.amount;
    if (next < 0) {
      throw new BillingError("Credit adjustment would make the balance negative.");
    }
    await tx.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: next,
        lifetimeGranted: input.amount > 0 ? { increment: input.amount } : undefined,
      },
    });
    try {
      const entry = await tx.creditLedgerEntry.create({
        data: {
          creditAccountId: account.id,
          type,
          amount: input.amount,
          balanceAfter: next,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          createdById: input.actorUserId,
        },
      });
      return { duplicate: false, balanceAfter: next, entryId: entry.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await tx.creditLedgerEntry.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return { duplicate: true, balanceAfter: existing?.balanceAfter ?? account.balance, entryId: existing?.id ?? "" };
      }
      throw error;
    }
  });
}
