-- Journal WhatsApp (envois, statuts, messages reçus) : table prévue au schéma mais jamais créée
-- en production. Nécessaire au journal, aux relances et à l'assistant de commande WhatsApp.
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "direction" TEXT NOT NULL,
  "toNumber" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_providerId_idx" ON "WhatsAppMessage"("providerId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_toNumber_createdAt_idx" ON "WhatsAppMessage"("toNumber", "createdAt");
