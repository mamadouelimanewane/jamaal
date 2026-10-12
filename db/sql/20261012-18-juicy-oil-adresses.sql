-- Import Chogan du 12/10 : deux adresses de fiche avaient le n° Chogan tronqué (nom trop long).
-- Correction (rejouable : ne touche que les anciennes adresses, si la nouvelle est libre).
UPDATE "Product" SET slug = 'juicy-oil-huile-levres-hydratante-cerise-noire-14416'
WHERE slug = 'juicy-oil-huile-levres-hydratante-cerise-noire-1'
  AND NOT EXISTS (SELECT 1 FROM "Product" WHERE slug = 'juicy-oil-huile-levres-hydratante-cerise-noire-14416');

UPDATE "Product" SET slug = 'juicy-oil-huile-levres-hydratante-coco-sale-14426'
WHERE slug = 'juicy-oil-huile-levres-hydratante-coco-sale-1442'
  AND NOT EXISTS (SELECT 1 FROM "Product" WHERE slug = 'juicy-oil-huile-levres-hydratante-coco-sale-14426');
