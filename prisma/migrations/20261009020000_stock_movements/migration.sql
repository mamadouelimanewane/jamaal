-- Gestion des stocks : type et origine de chaque mouvement, état du stock réservé par commande.
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'AJUSTEMENT';
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reference" TEXT;
CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx" ON "StockMovement"("orderId");
CREATE INDEX IF NOT EXISTS "StockMovement_kind_createdAt_idx" ON "StockMovement"("kind", "createdAt");
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stockState" TEXT;
