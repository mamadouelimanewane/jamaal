CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referrerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "usedById" TEXT,
  "rewardPoints" INTEGER NOT NULL DEFAULT 2000,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "consultantId" TEXT NOT NULL,
  "discountPct" INTEGER NOT NULL DEFAULT 5,
  "description" TEXT,
  "usageLimit" INTEGER NOT NULL DEFAULT 0,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FastStartBonus" (
  "id" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "sponsoreeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 15000,
  "awardedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FastStartBonus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");
CREATE INDEX "Referral_code_idx" ON "Referral"("code");
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_consultantId_idx" ON "PromoCode"("consultantId");
CREATE UNIQUE INDEX "FastStartBonus_sponsorId_sponsoreeId_key" ON "FastStartBonus"("sponsorId", "sponsoreeId");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "Consultant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_usedById_fkey"
  FOREIGN KEY ("usedById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FastStartBonus" ADD CONSTRAINT "FastStartBonus_sponsorId_fkey"
  FOREIGN KEY ("sponsorId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FastStartBonus" ADD CONSTRAINT "FastStartBonus_sponsoreeId_fkey"
  FOREIGN KEY ("sponsoreeId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;