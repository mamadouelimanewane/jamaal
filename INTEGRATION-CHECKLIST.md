# Checklist d'intégration JAMAAL — Phase 1 → 3

Suivre **dans l’ordre**. Cocher au fur et à mesure.

---

## A. Préparation

- [ ] Cloner / ouvrir le repo `mamadouelimanewane/jamaal`
- [ ] `npm install`
- [ ] `npm install zod`
- [ ] (Optionnel) `npm install @sentry/nextjs stripe`
- [ ] Copier `.env.example` → `.env` et renseigner `DATABASE_URL`, `NEXTAUTH_SECRET`

---

## B. Base de données

- [ ] Ajouter `slug String? @unique` + index sur `Consultant` (`prisma/schema-patch.prisma`)
- [ ] Ajouter enums + champs paiement sur `Order` (`prisma/payment-schema-patch.prisma`)
- [ ] `npx prisma migrate dev --name add_slug_and_payment`
- [ ] Seed : slug `consultant-demo` sur le consultant démo
- [ ] `npm run db:seed` si besoin

---

## C. Fichiers cœur (copier / remplacer)

### Lib
- [ ] `src/lib/ref.ts`
- [ ] `src/lib/rate-limit.ts`
- [ ] `src/lib/validations/order.ts`
- [ ] `src/lib/settings.ts`
- [ ] `src/lib/commission.ts`
- [ ] `src/lib/revenue.ts`
- [ ] `src/lib/sponsor-notifications.ts`
- [ ] `src/lib/payment/**` (tout le dossier)
- [ ] `src/lib/actions/orders.ts`
- [ ] `src/lib/actions/consultants.ts`
- [ ] `src/lib/actions/public-data.ts`
- [ ] `src/lib/actions/settings.ts`
- [ ] `src/lib/actions/payment.ts`
- [ ] `src/lib/actions/payment-options.ts`
- [ ] `src/lib/actions/onboarding.ts`
- [ ] `src/lib/actions/consultant-dashboard.ts` (optionnel)

### Data
- [ ] `src/data/sales-scripts.ts`
- [ ] `src/data/onboarding.ts`

### Components
- [ ] `src/components/PaymentMethodSelector.tsx`
- [ ] `src/components/admin/ConsultantForm.tsx`
- [ ] `src/components/admin/PersonalLinkCard.tsx`
- [ ] `src/components/admin/ScriptCard.tsx`
- [ ] `src/components/admin/CatalogShareCard.tsx`
- [ ] `src/components/admin/OnboardingChecklist.tsx`
- [ ] `src/components/admin/PaymentStatusBadge.tsx`

### Pages site
- [ ] `src/app/(site)/c/[slug]/page.tsx`
- [ ] `src/app/(site)/panier/page.tsx`
- [ ] `src/app/(site)/commande/[id]/page.tsx`

### Pages admin
- [ ] `src/app/(admin)/admin/(dashboard)/outils/page.tsx`
- [ ] `src/app/(admin)/admin/(dashboard)/formation/page.tsx`
- [ ] Patch sidebar `layout.tsx` (Outils + Formation)
- [ ] Patch dashboard : PersonalLinkCard + SponsorCommissionCard
- [ ] Patch comptabilité : 2 taux de commission
- [ ] Afficher `PaymentStatusBadge` dans listes commandes

### API
- [ ] `src/app/api/payment/wave/webhook/route.ts`
- [ ] `src/app/api/payment/stripe/webhook/route.ts`
- [ ] `src/app/api/payment/orange/webhook/route.ts`

### Config
- [ ] `src/proxy.ts` (ref cookie + auth admin)
- [ ] `next.config.ts` (headers sécu ; + Sentry si activé)

### Divers
- [ ] Dans `consultant-orders.ts` : `notifySponsorOnSale(consultant.id, total)`

---

## D. Variables d'environnement

- [ ] `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- [ ] `NEXT_PUBLIC_SITE_URL`
- [ ] (Prod) `WAVE_API_KEY` + webhook secret
- [ ] (Optionnel) Orange Money / Stripe
- [ ] (Optionnel) Sentry DSN

---

## E. Tests manuels

### Checkout
- [ ] Panier vide → message OK
- [ ] CGV non cochée → blocage
- [ ] Stock 0 → erreur claire
- [ ] Commande COD → `/commande/[id]` + statut « À la livraison »
- [ ] Rate limit : 6 commandes rapides → message d’attente

### Consultant / ref
- [ ] `/c/consultant-demo` pose le cookie
- [ ] Select consultant prérempli + verrouillé
- [ ] Commande rattachée au bon consultant
- [ ] Admin : créer consultant avec slug → page publique OK

### Outils & formation
- [ ] `/admin/outils` : scripts copiables + catalogue print/PNG
- [ ] `/admin/formation` : checklist + guides
- [ ] Dashboard : carte lien + commission parrainage

### Paiement (si clés)
- [ ] Wave : redirect + webhook → statut Payé
- [ ] Stripe : idem
- [ ] Confirmation affiche « Payé » / « En attente » / « Annulé »

### Admin
- [ ] Comptabilité : modifier taux revendeur + parrainage
- [ ] Badge paiement visible sur les commandes

---

## F. Déploiement Vercel

- [ ] Variables d’env production
- [ ] `NEXT_PUBLIC_SITE_URL=https://…`
- [ ] Webhooks Wave/Stripe pointent vers le domaine prod
- [ ] Test commande réelle en COD
- [ ] (Plus tard) activer Wave après KYB

---

## Ordre de mise en prod recommandé

1. Intégrer Phase 1+2 **sans** clés paiement → COD only  
2. Mettre en ligne, valider le parcours complet  
3. Finaliser KYB Wave → activer `WAVE_API_KEY`  
4. Brancher Sentry  
5. Orange Money / Stripe selon besoin  

---

## Docs du package

| Fichier | Contenu |
|---------|---------|
| `README.md` | Vue d’ensemble |
| `NOTES-INTEGRATION.md` | Détails techniques par section |
| `PAYMENT.md` | Paiement providers + KYB |
| `sentry/SENTRY.md` | Monitoring |
| `INTEGRATION-CHECKLIST.md` | Ce fichier |

---

## G. Phase 4 — Croissance

Voir **PHASE4.md**

- [ ] Migration `phase4-schema-patch.prisma` (Loyalty, Analytics, Wishlist optionnel)
- [ ] Copier `src/lib/loyalty.ts`, `src/lib/actions/loyalty.ts`
- [ ] Copier `src/lib/wishlist-store.ts`, `WishlistButton`, page `/wishlist`
- [ ] Copier quiz : `perfume-quiz.ts`, `PerfumeQuiz.tsx`, page `/quiz`
- [ ] Copier `src/lib/analytics.ts`
- [ ] Remplacer `commission.ts` + `settings.ts` (L2)
- [ ] Header : liens Quiz + Favoris
- [ ] Fiche produit : WishlistButton
- [ ] `updateOrderStatus(LIVREE)` → `earnLoyaltyForOrder`
- [ ] Tester quiz, wishlist, points après paiement/livraison
