-- Thèmes de boutique v2 (/c/<slug>) : 14 thèmes, accent au choix, mise en avant du haut de page,
-- typographie et sections masquables. Les anciens identifiants sont convertis vers les nouveaux.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopAccent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopHero" TEXT NOT NULL DEFAULT 'portrait';
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopTypo" TEXT NOT NULL DEFAULT 'theme';
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopHidden" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Consultant" ALTER COLUMN "shopTheme" SET DEFAULT 'maison';
UPDATE "Consultant" SET "shopTheme" = CASE "shopTheme"
  WHEN 'luxury-rose' THEN 'maison'
  WHEN 'noir-gold' THEN 'champagne'
  WHEN 'sahara-nude' THEN 'teranga'
  WHEN 'midnight-navy' THEN 'ciel'
  WHEN 'royal-emerald' THEN 'emeraude'
  WHEN 'pearl-minimal' THEN 'galerie'
  ELSE "shopTheme" END
WHERE "shopTheme" IN ('luxury-rose','noir-gold','sahara-nude','midnight-navy','royal-emerald','pearl-minimal');
