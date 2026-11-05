-- Photos et vidéos de la boutique du revendeur (galerie en bas de sa page), envoyées depuis la galerie du téléphone.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopMedia" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Kit marketing : description facultative d'un visuel ou d'une vidéo (texte proposé aux revendeurs).
ALTER TABLE "MarketingAsset" ADD COLUMN IF NOT EXISTS "caption" TEXT;
