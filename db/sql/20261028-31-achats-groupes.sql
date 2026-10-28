CREATE TABLE IF NOT EXISTS "GroupDeal" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "volumeLabel" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL DEFAULT 3,
  "discountPct" INTEGER NOT NULL DEFAULT 10,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "consultantId" TEXT REFERENCES "Consultant"("id") ON DELETE SET NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GroupDeal_status_expiresAt_idx" ON "GroupDeal"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "GroupDeal_consultantId_createdAt_idx" ON "GroupDeal"("consultantId", "createdAt");

CREATE TABLE IF NOT EXISTS "GroupDealParticipant" (
  "id" TEXT PRIMARY KEY,
  "dealId" TEXT NOT NULL REFERENCES "GroupDeal"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "couponCode" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupDealParticipant_dealId_phone_key" UNIQUE ("dealId", "phone")
);
CREATE INDEX IF NOT EXISTS "GroupDealParticipant_dealId_createdAt_idx" ON "GroupDealParticipant"("dealId", "createdAt");
