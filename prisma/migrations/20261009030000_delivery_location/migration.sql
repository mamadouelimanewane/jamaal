-- Livraison : position approximative (adresse floue) à confirmer, et cache de géocodage.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryApprox" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryPlace" TEXT;
CREATE TABLE IF NOT EXISTS "GeocodeCache" (
  "query" TEXT PRIMARY KEY,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "label" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
