-- Site vitrine en italien : descriptions des produits en italien (vides = le texte français s'affiche).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shortDescriptionIt" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "longDescriptionIt" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
