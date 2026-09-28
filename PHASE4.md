# Phase 4 — Croissance & premium

## Fonctionnalités livrées

| Module | Description |
|--------|-------------|
| **Wishlist** | Store Zustand + page `/wishlist` + bouton cœur |
| **Quiz parfum** | `/quiz` — 4 questions → suggestions catalogue |
| **Fidélité** | Points (1 / 1000 FCFA), échange 50 pts = 2500 FCFA |
| **Analytics** | `trackEvent` + agrégation admin |
| **Parrainage L2** | Commission niveau 2 (défaut 2 % sur petite-filleuls) |

## Prisma

Voir `prisma/phase4-schema-patch.prisma` :

- `LoyaltyAccount` / `LoyaltyEvent`
- `WishlistItem` (optionnel, sync serveur)
- `AnalyticsEvent`

```bash
npx prisma migrate dev --name add_phase4_loyalty_analytics
```

## Routes à créer

| Package | Destination |
|---------|-------------|
| `src/app/site/quiz/page.tsx` | `src/app/(site)/quiz/page.tsx` |
| `src/app/site/wishlist/page.tsx` | `src/app/(site)/wishlist/page.tsx` |

## Intégrations UX

1. **Header** : lien ❤️ Favoris (`/wishlist`) + compteur `useWishlistStore().count()`
2. **Fiche produit** : `<WishlistButton item={{...}} />`
3. **Home / Footer** : lien « Trouver mon parfum » → `/quiz`
4. **Après paiement** : `markOrderPaid` crédite déjà la fidélité
5. **Après livraison COD** : appeler `earnLoyaltyForOrder(orderId)` dans `updateOrderStatus` quand status = `LIVREE`

### Patch updateOrderStatus (COD fidélité)

```ts
// dans updateOrderStatus, après update :
if (status === "LIVREE") {
  await notifyConsultantOfDelivery(id);
  try {
    const { earnLoyaltyForOrder } = await import("@/lib/actions/loyalty");
    await earnLoyaltyForOrder(id);
  } catch {}
}
```

## Règles fidélité (modifiables dans `src/lib/loyalty.ts`)

- 1 point = 1000 FCFA de CA
- 50 points = 2500 FCFA de réduction (échange admin pour l’instant)

## Analytics

```ts
import { trackEvent } from "@/lib/analytics";

await trackEvent({ name: "add_to_cart", productId, path: "/produits/xxx" });
await trackEvent({ name: "purchase", orderId });
await trackEvent({ name: "quiz_complete" });
```

Dashboard : `getAnalyticsSummary(30)` → compteurs par nom d’événement.

## Commission L2

- Setting `sponsor_l2_commission_rate` (défaut 2)
- Exposé dans `getConsultantCommission()` → `monthlyL2Commission`, etc.
- Afficher sur le dashboard consultant à côté du L1

## Non inclus (volontairement)

- App mobile native
- GPS live livreur temps réel avancé
- Email/SMS marketing automation complet (Klaviyo, etc.)
- A/B testing framework
