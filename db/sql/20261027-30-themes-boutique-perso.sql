-- Bibliothèque de thèmes et personnalisation de la boutique personnelle (/c/<slug>) :
-- choix du thème visuel parmi la bibliothèque (Rose, Or nocturne, Sahara, Saphir, Émeraude, Perle)
-- et phrase d'accroche/slogan personnalisé. Additif et rejouable.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopTheme" TEXT DEFAULT 'luxury-rose';
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopTagline" TEXT;
