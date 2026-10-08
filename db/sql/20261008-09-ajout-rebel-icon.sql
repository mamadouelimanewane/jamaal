-- Produit Chogan absent de JAMAAL : Rebel Icon, parfum unisexe Luxury 50 ml (fiche 13311, code 106U).
-- Prix public Chogan 52,00 € → 34 110 FCFA ; prix JAMAAL = +25 % arrondi à 100 F.
INSERT INTO "Product" ("id","number","choganCode","slug","name","category","topNotes","heartNotes","baseNotes","shortDescription","longDescription","publicPrice","regularPrice","reviewCount","rating","colorFrom","colorTo","photo","isOfficial","stock","lowStockThreshold","inspiredBy","inspiredBrand","updatedAt")
VALUES (
  'chogan-13311', 13311, '106U', 'rebel-icon-parfum-unisexe-luxury-13311', 'Rebel Icon Parfum unisexe luxury', 'parfum-unisexe',
  '{}'::text[], '{}'::text[], '{}'::text[],
  'Rebel Icon Parfum unisexe luxury — 50 ml. Produit Chogan, distribué au Sénégal par JAMAAL.',
  ARRAY['Rebel Icon Parfum unisexe luxury. Format : 50 ml.', 'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, représentant exclusif.'],
  34110, 42600, 0, 4.6, '#1d2f4f', '#d9a99d',
  'https://cdn.chogangroupspa.com/images/prodotti/big/PR17634708680PR16982200610.jpg',
  true, 25, 5, 'Fucking Fabulous', 'Tom Ford', now()
)
ON CONFLICT ("id") DO NOTHING;
