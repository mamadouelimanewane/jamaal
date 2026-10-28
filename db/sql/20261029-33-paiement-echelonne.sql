-- Paiement en 2 ou 3 fois : nombre d'échéances (0 = en une fois), échéances payées, écart en jours,
-- références des paiements déjà comptés (idempotence) et date de la prochaine échéance (rappels).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentsPaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentIntervalDays" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentRefs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentNextDue" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Order_installmentNextDue_idx" ON "Order" ("installmentNextDue") WHERE "installmentCount" >= 2;
