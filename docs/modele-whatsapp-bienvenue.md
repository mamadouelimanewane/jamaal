# Modèle WhatsApp « bienvenue_revendeur » (à faire approuver chez Meta)

Le message de bienvenue part au moment où le revendeur n'a jamais écrit à JAMAAL : WhatsApp n'accepte alors
qu'un **modèle approuvé**. Sans ce modèle dédié, le code utilise le modèle générique `WHATSAPP_TEMPLATE_NAME`
(tout le texte dans une seule variable), ce qui fonctionne aussi mais est moins lisible.

## À créer dans Meta (WhatsApp Manager → Modèles de message → Créer)

| Champ | Valeur |
|---|---|
| Nom | `bienvenue_revendeur` |
| Catégorie | **Utility** (compte et accès du revendeur). Meta peut la reclasser en Marketing : c'est acceptable. |
| Langue | Français (`fr`) |
| Type | Texte, sans en-tête ni pied de page |

**Corps du message** (copier tel quel) :

```
Bienvenue chez JAMAAL, {{1}} ! 🎉 Vous rejoignez l'équipe de {{2}}, revendeur officiel Chogan au Sénégal. Pour démarrer : activez votre espace revendeur avec le lien d'activation transmis par l'équipe JAMAAL, puis partagez votre lien de vente personnel : {{3}}. Vous gagnez une commission sur chaque vente, et sur celles de votre équipe. Répondez simplement à ce message pour toute question.
```

**Exemples de variables** (Meta les demande pour valider) :
- `{{1}}` : Awa
- `{{2}}` : Fatou Ndiaye
- `{{3}}` : https://jamaal-nine.vercel.app/c/awa-diop

**Bouton (facultatif)** : « Visiter le site web », texte `Ouvrir mon espace`, URL statique
`https://jamaal-nine.vercel.app/admin/login`.

Le modèle ne doit ni commencer ni finir par une variable : c'est le cas ci-dessus.

## Activation côté site

Quand Meta indique « Approuvé », dans Vercel → Environment Variables, ajouter :

| Variable | Valeur |
|---|---|
| `WHATSAPP_TEMPLATE_WELCOME` | `bienvenue_revendeur` |

(la langue utilisée est `WHATSAPP_TEMPLATE_LANG`, `fr` par défaut), puis redéployer.

## Remarques
- Sans `WHATSAPP_TEMPLATE_WELCOME`, rien ne change : le modèle générique est utilisé.
- Chaque envoi (ou simulation) apparaît dans Admin → Journal WhatsApp.
- Avec Twilio, les modèles se gèrent côté Twilio ; le texte est envoyé tel quel.
