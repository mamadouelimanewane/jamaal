-- Wallet de versement des membres + commissions par commande + versements.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "walletProvider" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "walletNumber" TEXT;

CREATE TABLE IF NOT EXISTS "Payout" (
    "id" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "walletNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_COURS',
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payout_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Payout_consultantId_idx" ON "Payout"("consultantId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");

CREATE TABLE IF NOT EXISTS "CommissionEntry" (
    "id" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "base" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_VERSER',
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommissionEntry_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommissionEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommissionEntry_orderId_consultantId_level_key" ON "CommissionEntry"("orderId", "consultantId", "level");
CREATE INDEX IF NOT EXISTS "CommissionEntry_consultantId_status_idx" ON "CommissionEntry"("consultantId", "status");
