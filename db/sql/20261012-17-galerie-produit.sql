-- Galerie de photos produit : photos supplémentaires après la photo principale (import Chogan).
-- Additif et rejouable.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gallery" TEXT[] NOT NULL DEFAULT '{}';
