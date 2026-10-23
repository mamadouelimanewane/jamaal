-- Vendre plus : profil olfactif « Parfum ADN », abonnements de réassort, cartes cadeaux, cadeaux à distance.
-- Additif et rejouable.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "scentProfile" JSONB;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftOccasion" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftVoiceUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftFrom" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giftCardId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"            TEXT PRIMARY KEY,
  "token"         TEXT NOT NULL UNIQUE,
  "customerName"  TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "consultantId"  TEXT,
  "items"         JSONB NOT NULL,
  "intervalDays"  INTEGER NOT NULL DEFAULT 45,
  "discountPct"   INTEGER NOT NULL DEFAULT 5,
  "delivery"      JSONB,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt"     TIMESTAMP(3) NOT NULL,
  "remindedAt"    TIMESTAMP(3),
  "lastOrderId"   TEXT,
  "sourceOrderId" TEXT,
  "ordersCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Subscription_status_next_idx" ON "Subscription" ("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "Subscription_phone_idx" ON "Subscription" ("customerPhone");

CREATE TABLE IF NOT EXISTS "GiftCard" (
  "id"             TEXT PRIMARY KEY,
  "code"           TEXT NOT NULL UNIQUE,
  "amount"         INTEGER NOT NULL,
  "balance"        INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'EN_ATTENTE',
  "buyerName"      TEXT NOT NULL,
  "buyerPhone"     TEXT,
  "buyerEmail"     TEXT,
  "recipientName"  TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "occasion"       TEXT,
  "message"        TEXT,
  "voiceUrl"       TEXT,
  "consultantId"   TEXT,
  "paymentMethod"  TEXT,
  "paymentRef"     TEXT,
  "paidAt"         TIMESTAMP(3),
  "sentAt"         TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GiftCard_status_idx" ON "GiftCard" ("status");
