-- Prix de vente JAMAAL = prix public Chogan (€ × 655,957, en FCFA) + 25 %, arrondi à 100 FCFA.
-- Ne touche que les produits ayant un prix public Chogan (renseigné par 20261008-01).
-- Même calcul que salePriceFromPublic() (src/lib/business-model.ts) avec salePct = 125.
UPDATE "Product"
SET "regularPrice" = GREATEST(100, (ROUND("publicPrice" * 125 / 100.0 / 100) * 100)::int),
    "updatedAt" = now()
WHERE "publicPrice" > 0
  AND "regularPrice" IS DISTINCT FROM GREATEST(100, (ROUND("publicPrice" * 125 / 100.0 / 100) * 100)::int);
