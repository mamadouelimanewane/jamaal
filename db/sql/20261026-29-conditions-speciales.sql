-- Conditions spéciales par revendeur : encaissement direct (espèces / mobile money), commission propre, zones de livraison propres.
-- Additif et rejouable.
CREATE TABLE IF NOT EXISTS "SpecialTerms" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "collectMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "creditLimit" INTEGER NOT NULL DEFAULT 0,
  "sellerPct" DOUBLE PRECISION,
  "level1Pct" DOUBLE PRECISION,
  "level2Pct" DOUBLE PRECISION,
  "zones" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "specialTermsId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_specialTermsId_fkey" FOREIGN KEY ("specialTermsId") REFERENCES "SpecialTerms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Consultant_specialTermsId_idx" ON "Consultant"("specialTermsId");
