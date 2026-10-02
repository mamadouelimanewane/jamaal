-- Supprime 20 produits Chogan importés en double d'un produit déjà au catalogue.
-- (les produits déjà commandés sont conservés)
DELETE FROM "Product" WHERE "id" IN (
  'chogan-7574',
  'chogan-7671',
  'chogan-7694',
  'chogan-7747',
  'chogan-7773',
  'chogan-7874',
  'chogan-7875',
  'chogan-7887',
  'chogan-7888',
  'chogan-7913',
  'chogan-7920',
  'chogan-7970',
  'chogan-8058',
  'chogan-8072',
  'chogan-8447',
  'chogan-8470',
  'chogan-8484',
  'chogan-8574',
  'chogan-8680',
  'chogan-9177'
) AND NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."productId" = "Product"."id");
