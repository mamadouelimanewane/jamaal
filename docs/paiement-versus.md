# Paiement Wave / Orange Money / carte bancaire via Versus Business

Une seule intégration (`src/lib/payment/versus.ts`) derrière les trois moyens de paiement du panier.
Dès que les variables ci-dessous sont définies sur Vercel, Wave, Orange Money et Carte bancaire
passent par Versus (les clés Wave / Orange / Stripe directes ne sont plus utilisées).

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Rôle |
|---|---|
| `VERSUS_BASE_URL` | `https://business-staging.versusfintech.com` pour les tests, l'URL de production fournie par Versus ensuite |
| `VERSUS_LOGIN` | identifiant API |
| `VERSUS_PASSWORD` | mot de passe API |
| `VERSUS_WEBHOOK_TOKEN` | secret de votre choix (long, aléatoire) ajouté à l'URL du webhook |
| `VERSUS_MERCHANT_NAME` | facultatif, nom affiché au client (« JAMAAL » par défaut) |

## Webhook à déclarer chez Versus

`https://jamaal-nine.vercel.app/api/payment/versus/webhook?token=<VERSUS_WEBHOOK_TOKEN>`

Versus ne signe pas ses webhooks. Le code ne se fie donc jamais au contenu reçu : il relit le paiement
chez Versus avec la référence enregistrée à la création, et ne valide que s'il est `COMPLETED`, pour la
même commande et le montant exact. Les commissions, la fidélité et le message WhatsApp « Paiement reçu »
partent alors comme pour les autres moyens de paiement.

## Parcours client

- Wave / Orange Money : redirection vers la page Versus, où le client choisit son moyen et paie.
- Carte bancaire : redirection directe vers le paiement par carte.
- Retour sur `/commande/<id>?paid=1` ou `?canceled=1`.

## Test

`npm test` couvre le client avec un faux serveur. En staging, créez une commande, payez-la depuis la page
Versus, puis vérifiez dans Admin → Commandes que le statut passe à « Payé ».
