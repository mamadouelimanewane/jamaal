# JAMAAL Luxury Cosmetics

Boutique en ligne JAMAAL — parfums et cosmétiques inspirés des grandes maisons de
parfumerie, à prix juste. Application construite avec Next.js 16 (App Router),
React 19, TypeScript, Tailwind CSS v4 et Zustand.

## Origine du projet

Ce site reprend **l'architecture et le modèle** d'une vitrine de revendeur/consultant
indépendant du groupe CHOGAN (parfums "inspirés de" grandes marques, vendus en
vente directe) : slider d'accueil, barre de recherche par nom/numéro, catégories
(parfums femme/homme, soins, maquillage, bijoux, entretien maison, compléments,
parfums d'ambiance...), fiche produit avec notes olfactives et volumes, panier,
page "devenir consultant", liste de consultants, avis clients, blog.

**Important — ce qui a été volontairement recréé plutôt que copié :**

- Tous les **textes** (descriptions produits, articles de blog, blocs explicatifs)
  sont rédigés spécifiquement pour JAMAAL. Aucun texte n'a été copié du site
  d'inspiration ou de la marque CHOGAN.
- Tous les **visuels produits** sont des illustrations SVG générées (flacons,
  pots, tubes...) dans les couleurs JAMAAL — aucune photo n'a été téléchargée
  depuis un site tiers.
- Le **catalogue** (numérotation des parfums, familles olfactives, prix) est une
  création originale de démonstration, distincte de la numérotation réelle des
  produits CHOGAN.
- Il n'y a **aucun scraping ni synchronisation automatique** avec un site tiers :
  ce serait à la fois fragile techniquement et risqué juridiquement (le contenu
  d'un site concurrent/consultant appartient à son auteur).

## Pour aller vers une vraie boutique consultant (si vous devenez consultant·e)

1. Remplacez le contenu de démonstration dans `src/data/products.ts`,
   `src/data/blog.ts`, `src/data/consultants.ts` par vos données réelles.
2. Si votre organisation (ex. CHOGAN) vous fournit un catalogue officiel
   (export CSV/API, visuels marketing autorisés), écrivez un script d'import qui
   génère `src/data/products.ts` à partir de ce flux plutôt que de dupliquer le
   contenu d'un autre site.
3. Remplacez les visuels placeholder (`ProductBottle.tsx`) par vos photos
   produits officielles (`public/produits/...` + `next/image`).
4. Ajoutez votre vrai lien d'inscription consultant, numéro WhatsApp, et vos
   informations légales (mentions légales, CGV) avant toute mise en production.
5. Branchez un vrai moyen de paiement (Stripe, etc.) : la page `/panier` est un
   tunnel de commande factice qui ne traite aucun paiement réel.

## Démarrage

```bash
npm install
npm run dev
```

Le site tourne sur `http://localhost:3030` (voir `.claude/launch.json` au niveau
de `C:/gravity`).

## Structure

- `src/data/` — catalogue, catégories, blog, avis, consultants (démonstration)
- `src/components/` — Header, Footer, HeroSlider, ProductCard, CartDrawer...
- `src/app/` — pages App Router (accueil, collections, produits, panier, blog...)
- `src/lib/cart-store.ts` — panier (Zustand + persistance localStorage)
