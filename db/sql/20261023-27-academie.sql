-- Académie : forme des libellés de badges choisie par le consultant (« f » Experte, « m » Expert). Additif et rejouable.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "titleForm" TEXT;
