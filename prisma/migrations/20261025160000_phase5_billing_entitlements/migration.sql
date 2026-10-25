-- Billing: configurable plan credits, provider price ids, payment failure reason.

ALTER TABLE "Plan" ADD COLUMN "monthlyCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "stripeMonthlyPriceId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "stripeYearlyPriceId" TEXT;

UPDATE "Plan" SET "monthlyCredits" = 200 WHERE "code" = 'FREE';
UPDATE "Plan" SET "monthlyCredits" = 3000 WHERE "code" = 'STARTER';
UPDATE "Plan" SET "monthlyCredits" = 20000 WHERE "code" = 'PRO';
UPDATE "Plan" SET "monthlyCredits" = 100000 WHERE "code" = 'BUSINESS';

ALTER TABLE "Subscription" ADD COLUMN "providerCustomerId" TEXT;

ALTER TABLE "Payment" ADD COLUMN "failureReason" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
