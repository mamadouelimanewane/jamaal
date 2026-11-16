-- Nom de la boutique du revendeur : affiché à la place de son nom sur sa page (/c/…) et dans l'annuaire.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopName" TEXT;
