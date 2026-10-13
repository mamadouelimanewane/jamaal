-- WhatsApp partout : origine des commandes, kit du matin, boîte de réception, campagnes. Additif et rejouable.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'SITE';
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "kitMatin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_channel_idx" ON "Order"("channel");

CREATE TABLE IF NOT EXISTS "WhatsAppThread" (
  "phone" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  "botPausedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WhatsAppThread_lastMessageAt_idx" ON "WhatsAppThread"("lastMessageAt");

CREATE TABLE IF NOT EXISTS "WhatsAppCampaign" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BROUILLON',
  "total" INTEGER NOT NULL DEFAULT 0,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3)
);

-- Commandes déjà passées par l'assistant WhatsApp (avant cette colonne) : origine retrouvée.
UPDATE "Order" o SET "channel" = 'WHATSAPP'
WHERE "channel" = 'SITE' AND EXISTS (
  SELECT 1 FROM "WhatsAppMessage" m WHERE m."kind" = 'bot' AND m."body" LIKE '%' || '/commande/' || o."id" || '%'
);
