# WhatsApp Business API — configuration (niveau 2)

Le site envoie des messages WhatsApp automatiques (candidature, contact, commande → équipe et revendeur).
Sans configuration, **rien n'est envoyé** : les messages sont « SIMULÉS » et visibles dans
**Admin → Réseau → Journal WhatsApp**.

## Test gratuit avec l'API Cloud de Meta (recommandé)
1. https://developers.facebook.com → *Mes applications* → *Créer une application* → type **Entreprise** → ajouter le produit **WhatsApp**.
2. Onglet *WhatsApp → Configuration de l'API* : Meta fournit un **numéro de test**, son **identifiant de numéro de téléphone** et un **jeton d'accès temporaire** (24 h).
3. Dans « À », ajoutez vos numéros de test (jusqu'à 5) et validez le code reçu sur chacun.
4. Dans Vercel → Settings → Environment Variables (Production) :
   - `WHATSAPP_PROVIDER` = `meta`
   - `WHATSAPP_TOKEN` = jeton d'accès
   - `WHATSAPP_PHONE_NUMBER_ID` = identifiant du numéro de test
   - (facultatif) `WHATSAPP_TEMPLATE_NAME` = nom d'un modèle approuvé (voir plus bas)
5. Redéployez, puis **Admin → Journal WhatsApp → Envoyer un test**.

> En test, un message « texte libre » n'arrive que si le destinataire vous a écrit dans les dernières 24 h
> (envoyez d'abord « bonjour » au numéro de test depuis votre téléphone). Pour écrire sans cette condition,
> il faut un **modèle** approuvé.

## Modèle de message (pour écrire hors fenêtre de 24 h)
Créer dans Meta (WhatsApp → Modèles de message), catégorie **Utility**, langue **Français (fr)** :
- Nom : `jamaal_alerte`
- Corps : `JAMAAL : {{1}}`
Puis `WHATSAPP_TEMPLATE_NAME=jamaal_alerte`.

## Webhook (statuts « livré/lu » et réponses reçues)
- URL de rappel : `https://jamaal-nine.vercel.app/api/whatsapp/webhook`
- Jeton de vérification : inventez une valeur → `WHATSAPP_VERIFY_TOKEN`
- Secret de l'application (Paramètres → Général) → `WHATSAPP_APP_SECRET`
- Abonnez le champ **messages**.

## Autres prestataires
- **360dialog** : même format que Meta (`WHATSAPP_PROVIDER=meta`) ; renseignez leur clé et l'URL fournie si elle diffère.
- **Twilio** : `WHATSAPP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (ex. `+14155238886` pour le sandbox).

Ne communiquez jamais ces clés dans une conversation : placez-les uniquement dans Vercel.
