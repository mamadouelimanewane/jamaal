-- Statistiques de la boutique personnelle (/c/<slug>) : visites, clics WhatsApp, clics produits.
-- Une ligne par événement ; « sid » est un identifiant de visite anonyme (aucune donnée personnelle).
CREATE TABLE IF NOT EXISTS "ShopEvent" (
  "id" TEXT PRIMARY KEY,
  "consultantId" TEXT NOT NULL REFERENCES "Consultant"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "productId" TEXT,
  "sid" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShopEvent_consultantId_createdAt_idx" ON "ShopEvent" ("consultantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopEvent_sid_idx" ON "ShopEvent" ("sid");
