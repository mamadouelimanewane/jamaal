-- Crédits de marchandises des revendeurs, remboursés automatiquement par leurs ventes.
DO $$ BEGIN
  CREATE TYPE "GoodsCreditStatus" AS ENUM ('EN_COURS', 'SOLDE', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "GoodsCredit" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "consultantId" TEXT NOT NULL REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL,
  "balance" INTEGER NOT NULL,
  "repaid" INTEGER NOT NULL DEFAULT 0,
  "status" "GoodsCreditStatus" NOT NULL DEFAULT 'EN_COURS',
  "items" JSONB NOT NULL DEFAULT '[]',
  "dueDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "GoodsCredit_reference_key" ON "GoodsCredit"("reference");
CREATE INDEX IF NOT EXISTS "GoodsCredit_consultantId_status_idx" ON "GoodsCredit"("consultantId", "status");

CREATE TABLE IF NOT EXISTS "GoodsCreditDeduction" (
  "id" TEXT PRIMARY KEY,
  "creditId" TEXT NOT NULL REFERENCES "GoodsCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "orderId" TEXT,
  "amount" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GoodsCreditDeduction_creditId_createdAt_idx" ON "GoodsCreditDeduction"("creditId", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsCreditDeduction_orderId_idx" ON "GoodsCreditDeduction"("orderId");
-- Une vente ne rembourse un même crédit qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS "GoodsCreditDeduction_vente_unique" ON "GoodsCreditDeduction"("creditId", "orderId") WHERE "kind" = 'VENTE';
