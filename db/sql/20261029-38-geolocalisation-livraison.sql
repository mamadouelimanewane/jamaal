-- Géolocalisation de bout en bout : trace GPS des livreurs, précision / vitesse / cap,
-- distance entre le point de remise et l'adresse, alerte « le livreur arrive ».
CREATE TABLE IF NOT EXISTS "LivreurPing" (
  "id" TEXT PRIMARY KEY,
  "livreurId" TEXT NOT NULL REFERENCES "Livreur"("id") ON DELETE CASCADE,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LivreurPing_livreurId_createdAt_idx" ON "LivreurPing" ("livreurId", "createdAt");
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "lastAccuracy" DOUBLE PRECISION;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "lastHeading" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredDistanceM" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "arrivingNotifiedAt" TIMESTAMP(3);
