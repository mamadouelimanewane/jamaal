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

## Base de données

Le schéma est dans `prisma/schema.prisma` et les migrations dans `prisma/migrations/`.
Elles ne sont **pas** appliquées automatiquement au déploiement :

```bash
npx prisma migrate deploy
```

## Structure

- `src/app/(site)/` — pages publiques ; `src/app/(admin)/admin/` — back-office
- `src/app/api/` — exports, webhooks de paiement et WhatsApp, suivi de commande
- `src/lib/actions/` — actions serveur (chaque action vérifie le rôle avec `requireAdmin`,
  `requireStaff`… ; les fonctions internes non protégées restent hors des fichiers `"use server"`)
- `src/proxy.ts` — attribution revendeur (`?ref=`) et protection des routes `/admin`
- `src/lib/rate-limit.ts` — limitation de débit partagée (table `RateLimitBucket`)
- `src/components/` — composants de la boutique et du back-office
