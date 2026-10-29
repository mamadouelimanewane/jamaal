-- Inscription des livreurs depuis l'application Livreur (/admin/livreur) : la fiche reste « EN_ATTENTE »
-- (inactive, compte bloqué) jusqu'à la validation par l'administrateur.
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIF';
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "vehicle" TEXT;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "zone" TEXT;
ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
CREATE INDEX IF NOT EXISTS "Livreur_status_idx" ON "Livreur" ("status");
