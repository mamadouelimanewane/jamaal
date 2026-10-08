-- Module livraison : étapes géolocalisées, code de remise, gains et wallet des livreurs.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryDistanceKm" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "livreurShare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "walletProvider" TEXT;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "walletNumber" TEXT;

CREATE TABLE IF NOT EXISTS "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "livreurId" TEXT,
    "status" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryEvent_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryEvent_orderId_idx" ON "DeliveryEvent"("orderId");

CREATE TABLE IF NOT EXISTS "LivreurEarning" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_VERSER',
    "provider" TEXT,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivreurEarning_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LivreurEarning_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LivreurEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LivreurEarning_orderId_key" ON "LivreurEarning"("orderId");
CREATE INDEX IF NOT EXISTS "LivreurEarning_livreurId_status_idx" ON "LivreurEarning"("livreurId", "status");
