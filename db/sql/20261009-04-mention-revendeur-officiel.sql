-- JAMAAL n'est pas « représentant exclusif » : il est revendeur officiel de la marque CHOGAN (Italie).
-- Corrige la mention dans les descriptions des produits (rejouable sans effet).
UPDATE "Product"
SET "longDescription" = ARRAY(
  SELECT replace(d, 'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, représentant exclusif.',
                    'Produit officiel de la gamme Chogan, distribué au Sénégal par JAMAAL, revendeur officiel de la marque CHOGAN (Italie).')
  FROM unnest("longDescription") WITH ORDINALITY AS t(d, n) ORDER BY n
)
WHERE array_to_string("longDescription", ' ') LIKE '%représentant exclusif%';

UPDATE "Product"
SET "shortDescription" = replace("shortDescription", 'représentant exclusif', 'revendeur officiel de la marque CHOGAN (Italie)')
WHERE "shortDescription" LIKE '%représentant exclusif%';
