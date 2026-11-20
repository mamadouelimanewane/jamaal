-- Annonces ciblées : envoyées à une sélection de revendeurs (selon leurs statistiques), texte personnalisé.
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "consultantIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "personalized" JSONB;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "statsDays" INTEGER;
