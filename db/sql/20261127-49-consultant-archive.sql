-- Suppression d'un consultant = archivage : la fiche, ses ventes, crédits, wallet, filleuls et historiques sont conservés.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Consultant_archivedAt_idx" ON "Consultant"("archivedAt");
