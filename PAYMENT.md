# Module paiement JAMAAL

## Modes supportés

| Mode | ID | Disponibilité |
|------|-----|---------------|
| Paiement à la livraison | `cod` | Toujours |
| Wave | `wave` | Si `WAVE_API_KEY` |
| Orange Money | `orange_money` | Si clés OM configurées |
| Carte (Stripe) | `stripe` | Si `STRIPE_SECRET_KEY` |

## Schéma Prisma

Ajouter sur `Order` (voir `prisma/payment-schema-patch.prisma`) :

```prisma
paymentMethod   PaymentMethod  @default(COD)
paymentStatus   PaymentStatus  @default(NONE)
paymentRef      String?
paidAt          DateTime?
```

```bash
npx prisma migrate dev --name add_payment_fields
```

## Flux checkout

1. Client remplit le panier → `createOrder(...)` → `orderId`
2. Client choisit le mode de paiement
3. `initiatePayment(orderId, method)`
   - **COD** → redirection `/commande/[id]`
   - **Wave / OM / Stripe** → redirect vers l’URL du provider
4. Webhook marque `paymentStatus = PAID` + éventuellement `status = CONFIRMEE`

## Intégration panier (extrait)

```tsx
import { initiatePayment } from "@/lib/actions/payment";
import { PaymentMethodSelector } from "@/components/PaymentMethodSelector";
import type { PaymentProviderId } from "@/lib/payment/types";

const [method, setMethod] = useState<PaymentProviderId>("cod");

// Après createOrder :
const id = await createOrder(...);
const result = await initiatePayment(id, method);
if (result.redirect && result.url) {
  window.location.href = result.url;
} else {
  router.push(`/commande/${id}`);
}
```

Options disponibles côté serveur (page panier en RSC wrapper ou action) :

```ts
import { getAvailablePaymentProviders } from "@/lib/payment";
const options = getAvailablePaymentProviders().map((p) => ({
  id: p.id,
  label: p.label,
  description: p.description,
}));
```

## Variables d'environnement

```env
# Wave
WAVE_API_KEY=secret_xxx
WAVE_API_BASE=https://api.wave.com/v1
WAVE_WEBHOOK_SECRET=   # pour vérifier les webhooks

# Orange Money (selon contrat Sonatel)
ORANGE_MONEY_CLIENT_ID=
ORANGE_MONEY_CLIENT_SECRET=
ORANGE_MONEY_MERCHANT_KEY=
ORANGE_MONEY_TOKEN_URL=https://api.orange.com/oauth/v3/token
ORANGE_MONEY_PAYMENT_URL=
ORANGE_MONEY_NOTIF_URL=https://votre-domaine/api/payment/orange/webhook
ORANGE_MONEY_WEBHOOK_SECRET=   # obligatoire : ajouté en ?token= à la notif_url

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

NEXT_PUBLIC_SITE_URL=https://votre-domaine.com
```

## Webhooks

| Provider | Route |
|----------|-------|
| Wave | `POST /api/payment/wave/webhook` |
| Stripe | `POST /api/payment/stripe/webhook` |

Configurer ces URLs dans les dashboards marchands.

## Dépendances optionnelles

```bash
npm install stripe   # uniquement si Stripe activé
```

Wave et Orange Money utilisent `fetch` natif — pas de SDK obligatoire.

## Onboarding marchand (Sénégal)

### Wave Business
1. business.wave.com → compte marchand
2. KYB : NINEA, RCCM, pièce d’identité
3. Récupérer `WAVE_API_KEY`
4. Délai typique : 5–10 jours

### Orange Money
1. Portail developer.orange.com + dossier Sonatel Business
2. NINEA, RCCM, etc.
3. Sandbox puis production
4. Délai typique : 2–4 semaines

### Stripe
1. stripe.com → compte
2. Activer paiements (cartes) — XOF selon disponibilité du compte

## Recommandation de lancement

1. **Jour 0** : COD uniquement (déjà en place)
2. **Dès KYB Wave OK** : activer Wave (priorité Sénégal, frais ~1 %)
3. **Ensuite** : Orange Money
4. **Diaspora / cartes** : Stripe

Sans aucune clé, seul **COD** apparaît au checkout — le site reste fonctionnel.
