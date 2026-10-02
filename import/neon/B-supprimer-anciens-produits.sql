-- Supprime les produits du catalogue d'origine : il ne reste que la gamme Chogan (identifiants chogan-…).
-- Les commandes passées sont conservées (le nom du produit reste sur la ligne de commande).
DELETE FROM "Product" WHERE "id" NOT LIKE 'chogan-%';
