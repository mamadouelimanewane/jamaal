-- Logo du revendeur, affiché en haut de sa boutique personnelle (/c/<slug>).
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "shopLogo" TEXT;
