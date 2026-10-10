-- Mise en production : tout le stock repart de zéro, avant la saisie des marchandises reçues.
-- Chaque format non nul reçoit un mouvement « Inventaire » tracé. Ne s'exécute qu'une fois
-- (garde : mouvement de référence « MISE-EN-PRODUCTION » déjà présent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "StockMovement" WHERE "reference" = 'MISE-EN-PRODUCTION') THEN
    INSERT INTO "StockMovement" ("id", "productId", "variantId", "delta", "previousStock", "nextStock", "reason", "kind", "reference", "createdAt")
    SELECT 'zero_' || md5(v."id" || clock_timestamp()::text), v."productId", v."id", -v."stock", v."stock", 0,
           'Remise à zéro · mise en production', 'INVENTAIRE', 'MISE-EN-PRODUCTION', CURRENT_TIMESTAMP
    FROM "ProductVariant" v WHERE v."stock" <> 0;
    INSERT INTO "StockMovement" ("id", "productId", "variantId", "delta", "previousStock", "nextStock", "reason", "kind", "reference", "createdAt")
    SELECT 'zero_' || md5(p."id" || clock_timestamp()::text), p."id", NULL, -p."stock", p."stock", 0,
           'Remise à zéro · mise en production', 'INVENTAIRE', 'MISE-EN-PRODUCTION', CURRENT_TIMESTAMP
    FROM "Product" p WHERE p."stock" <> 0 AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id");
    -- Repère, même si tout était déjà à zéro.
    IF NOT EXISTS (SELECT 1 FROM "StockMovement" WHERE "reference" = 'MISE-EN-PRODUCTION') THEN
      INSERT INTO "StockMovement" ("id", "productId", "variantId", "delta", "previousStock", "nextStock", "reason", "kind", "reference", "createdAt")
      SELECT 'zero_marker', p."id", NULL, 0, 0, 0, 'Remise à zéro · mise en production', 'INVENTAIRE', 'MISE-EN-PRODUCTION', CURRENT_TIMESTAMP FROM "Product" p LIMIT 1;
    END IF;
    UPDATE "ProductVariant" SET "stock" = 0 WHERE "stock" <> 0;
    UPDATE "Product" SET "stock" = 0 WHERE "stock" <> 0;
  END IF;
END $$;
