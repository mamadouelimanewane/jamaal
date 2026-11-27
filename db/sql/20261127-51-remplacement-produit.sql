-- Remplacement d'un produit dans une commande pas encore livrée, et remboursements dans l'avoir du client.
-- paidBeforeChange : somme déjà payée quand un remplacement plus cher a rouvert le paiement (complément à payer).
-- avoirRefunded    : somme de la commande rendue au client dans son avoir (remplacement moins cher, réservation annulée).
-- refundPenalty    : pénalité retenue quand le client annule sa réservation après le délai gratuit.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidBeforeChange" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "avoirRefunded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundPenalty" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "OrderItemChange" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "oldProductId" TEXT,
  "oldName" TEXT NOT NULL,
  "oldVolume" TEXT NOT NULL,
  "oldPrice" INTEGER NOT NULL,
  "newProductId" TEXT NOT NULL,
  "newName" TEXT NOT NULL,
  "newVolume" TEXT NOT NULL,
  "newPrice" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "settlement" TEXT NOT NULL,
  "byRole" TEXT NOT NULL,
  "byName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItemChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderItemChange_orderId_idx" ON "OrderItemChange"("orderId");
