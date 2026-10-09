-- Wallet des revendeurs et des livreurs : registre des mouvements. Rejouable.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WALLET';
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALIDE',
  "provider" TEXT,
  "phone" TEXT,
  "providerRef" TEXT,
  "sourceId" TEXT,
  "orderId" TEXT,
  "note" TEXT,
  "error" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_sourceId_key" ON "WalletTransaction"("sourceId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_ownerType_ownerId_status_idx" ON "WalletTransaction"("ownerType", "ownerId", "status");
CREATE INDEX IF NOT EXISTS "WalletTransaction_status_kind_idx" ON "WalletTransaction"("status", "kind");

-- Gains déjà acquis mais pas encore versés : crédités sur le wallet.
INSERT INTO "WalletTransaction" ("id", "ownerType", "ownerId", "amount", "kind", "status", "sourceId", "orderId", "note", "createdAt", "updatedAt")
SELECT 'wtx_' || e."id", 'CONSULTANT', e."consultantId", e."amount",
       CASE WHEN e."level" LIKE 'PRIME_%' THEN 'PRIME' ELSE 'COMMISSION' END,
       'VALIDE', 'ce:' || e."id", CASE WHEN e."orderId" LIKE 'PRIME-%' THEN NULL ELSE e."orderId" END,
       'Repris à l''ouverture du wallet', e."createdAt", CURRENT_TIMESTAMP
FROM "CommissionEntry" e
WHERE e."status" = 'A_VERSER' AND e."payoutId" IS NULL AND e."amount" > 0
ON CONFLICT ("sourceId") DO NOTHING;
UPDATE "CommissionEntry" SET "status" = 'WALLET' WHERE "status" = 'A_VERSER' AND "payoutId" IS NULL AND "amount" > 0;

INSERT INTO "WalletTransaction" ("id", "ownerType", "ownerId", "amount", "kind", "status", "sourceId", "orderId", "note", "createdAt", "updatedAt")
SELECT 'wtx_' || l."id", 'LIVREUR', l."livreurId", l."amount", 'LIVRAISON', 'VALIDE', 'le:' || l."id", l."orderId",
       'Repris à l''ouverture du wallet', l."createdAt", CURRENT_TIMESTAMP
FROM "LivreurEarning" l
WHERE l."status" = 'A_VERSER' AND l."amount" > 0
ON CONFLICT ("sourceId") DO NOTHING;
UPDATE "LivreurEarning" SET "status" = 'WALLET' WHERE "status" = 'A_VERSER' AND "amount" > 0;
