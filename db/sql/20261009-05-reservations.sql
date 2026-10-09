-- Réservation d'un produit en rupture avec acompte (point 3 du document client). Rejouable.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isReservation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "depositAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationDelay" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reservationReadyAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Order_isReservation_reservationStatus_idx" ON "Order"("isReservation", "reservationStatus");
