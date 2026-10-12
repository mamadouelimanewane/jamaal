-- Fonctionnalités de croissance : commande WhatsApp, relances, offres de fêtes, défis, quiz,
-- veille des prix Chogan, avis avec photo. Additif et rejouable.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "whatsappOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "birthday" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "autoRelances" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "photo" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offerTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "choganCheckedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AutomationSent" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AbandonedCart" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "name" TEXT,
  "items" JSONB NOT NULL,
  "total" INTEGER NOT NULL,
  "consultantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remindedAt" TIMESTAMP(3),
  "orderedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "AbandonedCart_phone_idx" ON "AbandonedCart"("phone");
CREATE INDEX IF NOT EXISTS "AbandonedCart_updatedAt_idx" ON "AbandonedCart"("updatedAt");

CREATE TABLE IF NOT EXISTS "Offer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "occasion" TEXT,
  "description" TEXT NOT NULL DEFAULT '',
  "image" TEXT,
  "productIds" TEXT[] NOT NULL DEFAULT '{}',
  "packPrice" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Offer_slug_key" ON "Offer"("slug");
CREATE INDEX IF NOT EXISTS "Offer_active_endsAt_idx" ON "Offer"("active", "endsAt");

CREATE TABLE IF NOT EXISTS "Challenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "metric" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "bonus" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "awardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Challenge_active_endsAt_idx" ON "Challenge"("active", "endsAt");

CREATE TABLE IF NOT EXISTS "QuizResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "consultantId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuizResult_consultantId_quizId_key" ON "QuizResult"("consultantId", "quizId");

CREATE TABLE IF NOT EXISTS "ChoganPriceChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "oldPublic" INTEGER,
  "newPublic" INTEGER NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seen" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "ChoganPriceChange_detectedAt_idx" ON "ChoganPriceChange"("detectedAt");
