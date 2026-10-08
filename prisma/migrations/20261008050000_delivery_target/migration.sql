-- Livraison : adresse propre du consultant, destinataire et contact de la livraison.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryTarget" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryContactName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryContactPhone" TEXT;
