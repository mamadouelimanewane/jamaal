-- Pièce d'identité des livreurs (CNI, passeport ou permis), obligatoire à l'inscription. Stockée en base
-- (jamais sur une adresse publique) et visible seulement des administrateurs du module Livraison.
CREATE TABLE IF NOT EXISTS "LivreurDocument" (
  "id" TEXT PRIMARY KEY,
  "livreurId" TEXT NOT NULL REFERENCES "Livreur"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "side" TEXT NOT NULL DEFAULT 'RECTO',
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LivreurDocument_livreurId_idx" ON "LivreurDocument" ("livreurId");
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "idType" TEXT;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "docsVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
