-- Codes de parrainage créés par l'administrateur (additif, rejouable).
CREATE TABLE IF NOT EXISTS "SponsorCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "consultantId" TEXT NOT NULL,
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsorCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SponsorCode_code_key" ON "SponsorCode"("code");
CREATE INDEX IF NOT EXISTS "SponsorCode_consultantId_idx" ON "SponsorCode"("consultantId");
