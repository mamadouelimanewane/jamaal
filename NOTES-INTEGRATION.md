# Notes d'intégration précises

## 1. Schéma Prisma

Dans `model Consultant`, ajouter :

```prisma
slug      String?  @unique
// ...
@@index([slug])
```

Puis :

```bash
npx prisma migrate dev --name add_consultant_slug
```

## 2. Seed — slug consultant démo

Dans `prisma/seed.ts`, après création/upsert du consultant démo :

```ts
await prisma.consultant.update({
  where: { id: demoConsultant.id },
  data: { slug: "consultant-demo" },
});
```

Pour les consultants existants sans slug, un script one-shot :

```ts
import { prisma } from "./src/lib/prisma";
import { slugify } from "./src/lib/ref";

const list = await prisma.consultant.findMany({ where: { slug: null } });
for (const c of list) {
  let base = slugify(c.name) || "consultant";
  let slug = base;
  let i = 2;
  while (await prisma.consultant.findFirst({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  await prisma.consultant.update({ where: { id: c.id }, data: { slug } });
}
```

## 3. public-data.ts

Remplacer le select pour inclure `slug` (fichier fourni dans le package).

## 4. Dashboard consultant — PersonalLinkCard

Dans `src/app/(admin)/admin/(dashboard)/page.tsx`, fonction `ConsultantOverview` :

1. Import :
```ts
import { PersonalLinkCard } from "@/components/admin/PersonalLinkCard";
```

2. Juste après la grille de StatCards, ajouter :

```tsx
<div className="mt-10">
  <PersonalLinkCard slug={(user.consultant as { slug?: string | null }).slug} />
</div>
```

Le dashboard existant (commissions, rang, équipe) est déjà très complet — on n'ajoute que la carte lien.

## 5. Chemins de fichiers

| Package | Destination réelle |
|---------|-------------------|
| `src/app/site/c/slug/page.tsx` | `src/app/(site)/c/[slug]/page.tsx` |
| `src/app/site/panier/page.tsx` | `src/app/(site)/panier/page.tsx` |
| `src/app/site/commande/id/page.tsx` | `src/app/(site)/commande/[id]/page.tsx` |
| `src/lib/actions/orders.ts` | `src/lib/actions/orders.ts` |
| `src/lib/actions/consultants.ts` | `src/lib/actions/consultants.ts` |
| `src/lib/actions/public-data.ts` | `src/lib/actions/public-data.ts` |
| `src/lib/ref.ts` | `src/lib/ref.ts` |
| `src/lib/rate-limit.ts` | `src/lib/rate-limit.ts` |
| `src/lib/validations/order.ts` | `src/lib/validations/order.ts` |
| `src/components/admin/ConsultantForm.tsx` | idem |
| `src/components/admin/PersonalLinkCard.tsx` | idem |
| `src/proxy.ts` | `src/proxy.ts` |
| `next.config.ts` | `next.config.ts` |

## 6. Rate limit login (optionnel)

Dans `src/lib/auth.ts`, autour de `authorize` :

```ts
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
// Dans authorize, si vous avez accès aux headers via une autre voie,
// ou protéger la page login côté proxy.
```

Pour le login, le plus simple est un rate limit dans le proxy sur `/admin/login` (POST) — à ajouter si besoin.

## 7. Tests manuels

1. Stock = 0 → erreur au checkout  
2. `/c/consultant-demo` → cookie `jamaal_ref` → select verrouillé  
3. CGV non cochée → blocage  
4. Commande OK → `/commande/[id]`  
5. 6 commandes rapides → rate limit  
6. Admin : créer consultant avec slug `aminata` → `/c/aminata` OK  
7. Dashboard consultant → carte lien + bouton Copier  

## 8. Variables d'environnement recommandées

```env
DATABASE_URL=...
NEXTAUTH_SECRET=...   # openssl rand -base64 32
NEXTAUTH_URL=https://votre-domaine.com
SEED_ADMIN_EMAIL=...
SEED_ADMIN_PASSWORD=...  # changer après le premier login
NEXT_PUBLIC_SITE_URL=https://votre-domaine.com
```

---

## 9. Outils de vente (Phase 2 suite)

### Fichiers

| Package | Destination |
|---------|-------------|
| `src/data/sales-scripts.ts` | `src/data/sales-scripts.ts` |
| `src/components/admin/ScriptCard.tsx` | idem |
| `src/components/admin/CatalogShareCard.tsx` | idem |
| `src/app/admin-outils/page.tsx` | `src/app/(admin)/admin/(dashboard)/outils/page.tsx` |

### Sidebar consultant

Dans `layout.tsx` du dashboard, ajouter le lien :

```ts
import { MessageCircle } from "lucide-react";

const consultantLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
  { href: "/admin/outils", label: "Outils de vente", icon: MessageCircle },
];
```

### Fonctionnalités page `/admin/outils`

- Carte lien personnel (copier)
- 9 scripts WhatsApp (premier contact, relance, post-achat, recrutement, promo)
- Personnalisation prénom + produit + copie en 1 clic
- Mini-catalogue (20 best-sellers) : impression PDF + export PNG (html-to-image)
- Conseils de vente

### Variable d'env utile

```env
NEXT_PUBLIC_SITE_URL=https://jamaal-nine.vercel.app
```

Pour que les liens complets s'affichent correctement dans les scripts et le catalogue.

---

## 10. Formation + onboarding + parrainage

### Fichiers

| Package | Destination |
|---------|-------------|
| `src/data/onboarding.ts` | `src/data/onboarding.ts` |
| `src/components/admin/OnboardingChecklist.tsx` | idem |
| `src/lib/actions/onboarding.ts` | idem |
| `src/app/admin-formation/page.tsx` | `src/app/(admin)/admin/(dashboard)/formation/page.tsx` |
| `src/lib/settings.ts` | remplacer (ajoute sponsor_commission_rate) |
| `src/lib/commission.ts` | remplacer (commissions équipe) |
| `src/lib/revenue.ts` | remplacer (support consultantIds) |
| `src/lib/sponsor-notifications.ts` | remplacer (notif à chaque vente) |
| `src/app/admin-dashboard/SponsorCommission-snippet.tsx` | snippet UI |

### Sidebar

Ajouter :
```ts
{ href: "/admin/formation", label: "Formation", icon: BookOpen },
```

### createConsultantOrder

Dans `src/lib/actions/consultant-orders.ts`, remplacer :
```ts
await notifySponsorOnFirstSale(consultant.id);
```
par :
```ts
await notifySponsorOnSale(consultant.id, total);
```

### Dashboard

Après la carte commission directe, ajouter `SponsorCommissionCard` (snippet fourni).  
Optionnel : afficher `OnboardingChecklist` sur le dashboard si progression < 100%.

### Setting admin (optionnel)

Créer une entrée Setting `sponsor_commission_rate` = `5` (ou UI dans /admin/comptabilite).

---

## 11. Taux de commission parrainage (UI admin)

Fichiers :
- `src/lib/actions/settings.ts` → + `updateSponsorCommissionRate`
- `src/app/admin-settings/ComptabiliteRates-patch.tsx` → deux formulaires

Dans `comptabilite/page.tsx` :
1. Importer `getSponsorCommissionRate` et `updateSponsorCommissionRate`
2. Charger `sponsorRate` dans le Promise.all
3. Remplacer le bloc taux unique par `CommissionRatesForms` (ou le JSX du patch)

## 12. Sentry

Voir le dossier `sentry/` et `sentry/SENTRY.md`.

```bash
npm install @sentry/nextjs
# Copier les fichiers config
# Ajouter NEXT_PUBLIC_SENTRY_DSN sur Vercel
```

---

## 13. Paiement (Phase 3)

Voir **PAYMENT.md** à la racine du package.

Fichiers clés :
- `prisma/payment-schema-patch.prisma`
- `src/lib/payment/**`
- `src/lib/actions/payment.ts`
- `src/lib/actions/payment-options.ts`
- `src/components/PaymentMethodSelector.tsx`
- `src/app/api/payment/wave/webhook/route.ts`
- `src/app/api/payment/stripe/webhook/route.ts`
- Panier déjà branché (méthode + initiatePayment)

```bash
npx prisma migrate dev --name add_payment_fields
# optionnel
npm install stripe
```

Sans clés API → seul COD est proposé.
