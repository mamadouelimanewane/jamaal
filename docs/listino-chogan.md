# Listino Chogan : mise à jour des formats et des prix

Document source : « Listino Profumi Tribe — septembre 2026 » (liste de prix officielle, en euros).

## Règle de prix
Prix de vente d'un format = prix Chogan (€) × 655,957 × 1,25, arrondi à la centaine
(35 € → 28 700 FCFA, 18 € → 14 800, 11,90 € → 9 800, 52 € → 42 600, 60 € → 49 200).
Contrôle du 17 octobre 2026 : sur 143 références parfums et Luxury, **aucun écart de prix** avec le site.

## Ce que le listing ajoute au site
- 87 parfums n'avaient que le 70 ml : il manque le **30 ml** et le **15 ml recharge** (codes 3xx et Txxx).
- 27 références Luxury n'avaient pas la **recharge 15 ml**.
- Total : 206 formats à ajouter sur 119 produits (« Glory for Him » du listing = 167M sur le site : alias dans `src/data/chogan-listino.json`).
- Gels douche (BSF), crèmes (CRF), Scent of Love, Baby (045B / 058B / 059B) : déjà présents au bon prix.
- Étuis TCO V009, V011, V012, V013 : absents du site (noms et photos à récupérer chez Chogan).

## Appliquer
Admin → Produits → **Listino Chogan** : la page compare le listing au catalogue et le bouton
« Ajouter les formats manquants » les crée (formats, codes Chogan, lignes de stock à 0). L'opération est additive et
idempotente : aucun prix ni stock existant n'est modifié, une relance ne crée pas de doublon. Un produit sans stock par
format reçoit aussi la ligne de son format principal avec son stock actuel.

## Nouveau listing
```
node scripts/pdf-listino.cjs "chemin/listino.pdf"
```
régénère `src/data/chogan-listino.json` (la section « À vérifier » liste les lignes douteuses), puis la page Listino
montre les écarts de prix et les formats manquants.

## Pour les clients
La page **Petits formats** (`/petits-formats`, menu du site) présente les parfums en 30 ml et 15 ml recharge, dès 9 800 FCFA.
