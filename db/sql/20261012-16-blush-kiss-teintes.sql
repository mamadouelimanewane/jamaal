-- Blush & Kiss | Multi-use Stick : ajoute les teintes Peach (MM041, fiche Chogan 9479) et Berry
-- (MM042, fiche Chogan 9474). Jusqu'ici seule la teinte Watermelon (MM040, fiche 9484) était en
-- ligne. Les nouvelles fiches reprennent la catégorie et les prix de la fiche 9484 (même prix
-- public Chogan pour les trois teintes) et la photo officielle de chaque teinte.
-- Additif et rejouable : une fiche déjà présente n'est pas modifiée ; le stock part de 0.

INSERT INTO "Product" (
  "id", "number", "choganCode", "slug", "name", "category", "family",
  "topNotes", "heartNotes", "baseNotes", "shortDescription", "longDescription",
  "testerPrice", "volumes", "regularPrice", "publicPrice", "reviewCount", "rating", "badge",
  "colorFrom", "colorTo", "photo", "isOfficial", "stock", "lowStockThreshold", "updatedAt"
)
SELECT
  t.id, t.num, t.code, t.slug, t.name, p."category", p."family",
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], t.short, t.long,
  p."testerPrice", p."volumes", p."regularPrice", p."publicPrice", 0, p."rating", NULL,
  p."colorFrom", p."colorTo", t.photo, true, 0, p."lowStockThreshold", NOW()
FROM "Product" p
CROSS JOIN (VALUES
  ('chogan-9479', 9479, 'MM041', 'blush-kiss-multi-use-stick-peach-9479',
   'Blush & Kiss | Multi-use Stick — Peach',
   'Stick 2-en-1 joues et lèvres, teinte Peach (pêche) — fini mat, couvrance modulable, 7 g. Produit Chogan, distribué au Sénégal par JAMAAL.',
   ARRAY[
     'Stick multi-usage pour les joues et les lèvres, teinte Peach : une touche pêche lumineuse pour un teint frais et naturel.',
     'Fini mat, couvrance modulable, texture crémeuse facile à estomper. Enrichi en huile et farine de grains d''avoine et en aloe vera. Format : 7 g.',
     'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN (Italie).'
   ]::text[],
   'https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg'),
  ('chogan-9474', 9474, 'MM042', 'blush-kiss-multi-use-stick-berry-9474',
   'Blush & Kiss | Multi-use Stick — Berry',
   'Stick 2-en-1 joues et lèvres, teinte Berry (baie) — fini mat, couvrance modulable, 7 g. Produit Chogan, distribué au Sénégal par JAMAAL.',
   ARRAY[
     'Stick multi-usage pour les joues et les lèvres, teinte Berry : un rose baie intense pour un effet bonne mine.',
     'Fini mat, couvrance modulable, texture crémeuse facile à estomper. Enrichi en huile et farine de grains d''avoine et en aloe vera. Format : 7 g.',
     'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN (Italie).'
   ]::text[],
   'https://cdn.chogangroupspa.com/images/prodotti/big/PR17575883170MM042-BERRY.jpg')
) AS t(id, num, code, slug, name, short, long, photo)
WHERE p."id" = 'chogan-9484'
ON CONFLICT DO NOTHING;

-- La fiche 9484 porte la teinte Watermelon : on le précise dans son nom pour distinguer les trois
-- teintes (seulement si le nom n'a pas été modifié au back-office).
UPDATE "Product"
SET "name" = 'Blush & Kiss | Multi-use Stick — Watermelon', "updatedAt" = NOW()
WHERE "id" = 'chogan-9484' AND "name" = 'Blush & Kiss | Multi-use Stick';
