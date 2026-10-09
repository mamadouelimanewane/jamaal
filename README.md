# JAMAAL Luxury Cosmetics

Boutique en ligne et back-office de JAMAAL : parfums et cosmétiques de la gamme Chogan,
vendus au Sénégal (prix en FCFA) via un réseau de revendeurs.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand ·
Prisma 7 + PostgreSQL (Neon) · NextAuth v5 · déployé sur Vercel.

## Ce que fait l'application

- **Boutique publique** : catalogue par collections, fiche produit (notes olfactives, volumes),
  recherche, quiz parfum, favoris, panier, commande, suivi de livraison, avis, blog, parrainage,
  candidature revendeur, page personnelle de chaque revendeur (`/c/<slug>`).
- **Back-office** (`/admin`) avec trois rôles :
  - **ADMIN** : commandes, produits, stocks, clients, revendeurs, candidatures, coupons,
    comptabilité, statistiques, livreurs, blog, annonces, Centre WhatsApp, réglages ;
  - **CONSULTANT** (revendeur) : ventes, clients, filleuls, gains, kit marketing, profil ;
  - **LIVREUR** : livraisons et partage de position.
- **Paiement** : Wave, Orange Money, Stripe et paiement à la livraison (`PAYMENT.md`).
- **WhatsApp** : application installable (PWA), connexion par lien, envoi de messages
  (Meta / 360dialog / Twilio) — voir `docs/whatsapp-api-config.md`.

## Catalogue

Le catalogue en base est importé à partir des données Chogan :

- `src/data/chogan-catalog.json` — catalogue Chogan (les images sont servies par
  `cdn.chogangroupspa.com`, autorisé dans `next.config.ts`) ;
- `scripts/chogan-export.browser.js` — export du catalogue public Chogan depuis le navigateur ;
- `scripts/import-catalog.mjs` et `import/README.md` — import d'un catalogue CSV ;
- `import/neon/*.sql` — scripts SQL d'import appliqués sur la base Neon.

> L'utilisation des noms, textes et visuels Chogan, ainsi que les mentions affichées sur le site
> (« distribué par JAMAAL », « représentant exclusif »…), doivent correspondre à votre accord de
> distribution avec la marque. Vérifiez-les avec vos mentions légales et CGV.

## Démarrage

```bash
npm install          # génère aussi le client Prisma
npm run dev          # http://localhost:3000
```

Variables d'environnement principales (`.env`, jamais commité) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | base PostgreSQL (Neon) |
| `AUTH_SECRET` | secret NextAuth |
| `NEXT_PUBLIC_SITE_URL` | domaine public (liens WhatsApp, sitemap, aperçus) |
| `WAVE_*`, `ORANGE_MONEY_*`, `STRIPE_*` | paiement (voir `PAYMENT.md`) |
| `WHATSAPP_*` | envoi WhatsApp (voir `docs/whatsapp-api-config.md`) |
| `WAVE_PAYOUT_API_KEY` | versement des commissions sur Wave (clé « Payout » Wave Business) |
| `ORANGE_PAYOUT_URL`, `ORANGE_PAYOUT_TOKEN` | versement des commissions sur Orange Money (Sonatel ou agrégateur) |

## Base de données

Le schéma est décrit dans `prisma/schema.prisma`. La base Neon de production n'a **pas**
d'historique Prisma (`_prisma_migrations`) : ne lancez pas `prisma migrate deploy` dessus.

**Mises à jour automatiques** : chaque fichier de `db/sql/` est appliqué une seule fois, au
déploiement Vercel, par `scripts/db-migrate.mjs` (lancé par `npm run build`). Le suivi est dans
la table `_jamaal_sql`. Pour changer la base :

1. ajoutez la migration Prisma correspondante (`prisma/migrations/…`) pour garder le schéma à jour ;
2. ajoutez un nouveau fichier `db/sql/AAAAMMJJ-NN-description.sql`, **additif et rejouable**
   (`IF NOT EXISTS`…) : il s'applique aussi lors des prévisualisations, qui partagent la base ;
3. ne modifiez jamais un fichier déjà appliqué (le déploiement s'arrête) : créez-en un nouveau.

En local : `npm run db:migrate` applique les scripts sur la base de votre `.env`.
Les scripts de `import/neon/` sont l'historique des imports faits à la main ; ils ne sont pas rejoués.

## Structure

- `src/app/(site)/` — pages publiques ; `src/app/(admin)/admin/` — back-office
- `src/app/api/` — exports, webhooks de paiement et WhatsApp, suivi de commande
- `src/lib/actions/` — actions serveur (chaque action vérifie le rôle avec `requireAdmin`,
  `requireStaff`… ; les fonctions internes non protégées restent hors des fichiers `"use server"`)
- `src/proxy.ts` — attribution revendeur (`?ref=`) et protection des routes `/admin`
- `src/lib/rate-limit.ts` — limitation de débit partagée (table `RateLimitBucket`)
- `src/lib/business-model.ts` — modèle économique (prix, commissions, paiements, versements)
- `src/lib/payouts/` — commissions par commande et versements sur wallet Wave / Orange Money
- `src/lib/network.ts` — chaîne JAMAAL → Leader → Parrain direct → Consultant (vendeur final, ne parraine pas) et limite de filleuls
- `src/lib/stock.ts`, `src/lib/inventory-report.ts` — stocks par format (70 / 30 / 15 ml…) : ventes, annulations
  (remise en stock unique), réceptions, inventaires et pertes tracés dans `StockMovement` ; Admin > Stocks
  (tableau, réception / inventaire en lot, historique, export Excel)
- `npm test` (tests du moteur de recherche et des stocks) ; `npm run test:db` sur une base de test (`DATABASE_URL`)
- `src/lib/delivery.ts`, `src/lib/delivery-engine.ts` — livraison : frais selon la distance au dépôt,
  étapes géolocalisées, code de remise, part du livreur ; cartes Leaflet / OpenStreetMap
  (`src/components/maps/DeliveryMap.tsx`)
- `src/components/` — composants de la boutique et du back-office
