-- Boutique personnelle du consultant (/c/<slug>, le lien de bio Instagram / TikTok) : photo, présentation,
-- coups de cœur. Additif et rejouable.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopPhoto" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopBio" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "favorites" TEXT[] NOT NULL DEFAULT '{}';
