/** Réponses rapides à enregistrer dans l'application WhatsApp Business (Outils pour l'entreprise → Réponses rapides). */
export const QUICK_REPLIES: { shortcut: string; label: string; text: string }[] = [
  {
    shortcut: "/bienvenue",
    label: "Premier contact",
    text: "Bonjour et bienvenue chez JAMAAL ! 🌸 Nous sommes les représentants exclusifs de Chogan au Sénégal : parfums, soins, maquillage, nutrition et produits pour la maison. Dites-moi ce que vous cherchez et je vous conseille avec plaisir.",
  },
  {
    shortcut: "/catalogue",
    label: "Envoyer le catalogue",
    text: "Voici toute notre gamme avec les prix : https://jamaal-nine.vercel.app/collections — vous pouvez commander directement sur le site ou me dire ici ce que vous souhaitez, je m'occupe de tout.",
  },
  {
    shortcut: "/parfum",
    label: "Conseil parfum",
    text: "Pour vous conseiller le bon parfum, dites-moi : 1) pour une femme, un homme ou mixte ? 2) plutôt frais, floral, boisé, ou sucré/vanillé ? 3) pour tous les jours ou pour sortir ? Vous pouvez aussi faire notre quiz : https://jamaal-nine.vercel.app/quiz",
  },
  {
    shortcut: "/livraison",
    label: "Livraison",
    text: "Nous livrons à Dakar et dans les grandes villes, ou vous pouvez retirer votre commande auprès de votre consultant·e. Donnez-moi votre adresse ou votre quartier et je vous confirme le délai.",
  },
  {
    shortcut: "/paiement",
    label: "Moyens de paiement",
    text: "Vous pouvez payer à la livraison, en espèces ou par mobile money (Wave, Orange Money). Aucun paiement n'est demandé avant la confirmation de votre commande.",
  },
  {
    shortcut: "/commande",
    label: "Prendre une commande",
    text: "Parfait ! Pour enregistrer votre commande, j'ai besoin de : 1) votre nom 2) votre adresse de livraison 3) le(s) produit(s) et la quantité. Je vous envoie ensuite le récapitulatif et le total.",
  },
  {
    shortcut: "/revendeur",
    label: "Devenir consultant·e",
    text: "Vous voulez gagner de l'argent en vendant Chogan avec JAMAAL ? Postulez ici : https://jamaal-nine.vercel.app/devenir-consultant — vous aurez votre propre boutique en ligne, vos commissions et un espace pour suivre vos ventes.",
  },
  {
    shortcut: "/merci",
    label: "Remerciement après achat",
    text: "Merci pour votre commande ! 💛 N'hésitez pas à me dire ce que vous en pensez, et à partager nos produits à vos proches : chaque recommandation compte beaucoup pour nous.",
  },
  {
    shortcut: "/relance",
    label: "Relancer un client",
    text: "Bonjour ! Cela fait un moment. Nous avons de nouveaux produits Chogan qui pourraient vous plaire. Souhaitez-vous que je vous envoie les nouveautés ?",
  },
];

/** Message d'accueil et d'absence pour l'application WhatsApp Business. */
export const GREETING =
  "Bonjour ! Bienvenue chez JAMAAL, représentant exclusif de Chogan au Sénégal. 🌸 Comment pouvons-nous vous aider ?";
export const AWAY =
  "Merci pour votre message ! Nous sommes actuellement indisponibles et vous répondrons dès que possible. En attendant, découvrez toute la gamme : https://jamaal-nine.vercel.app/collections";

/** Étapes de configuration de l'application WhatsApp Business (gratuite). */
export const SETUP_STEPS = [
  "Installez l'application « WhatsApp Business » (gratuite, distincte de WhatsApp classique) sur le téléphone de la boutique.",
  "Profil de l'entreprise : nom « JAMAAL », catégorie « Beauté, cosmétiques et soins personnels », description, adresse/zone de livraison, site web https://jamaal-nine.vercel.app, et le logo.",
  "Outils pour l'entreprise → Réponses rapides : ajoutez les messages ci-dessous (copiez-collez chaque texte avec son raccourci).",
  "Outils pour l'entreprise → Message d'accueil et Message d'absence : collez les deux textes ci-dessous.",
  "Étiquettes : créez « Nouveau client », « Commande en cours », « Livré », « À relancer », « Consultant·e » pour trier vos conversations.",
  "Catalogue : ajoutez vos produits phares à la main (jusqu'à 500), ou importez le fichier du catalogue Chogan fourni par le Centre WhatsApp via Meta Commerce Manager.",
  "Liste de diffusion : envoyez vos nouveautés uniquement aux clients qui ont enregistré votre numéro (sinon le message n'est pas livré).",
  "Lien et QR code WhatsApp : Outils pour l'entreprise → Outils de vente → Lien court. Affichez-le sur vos flyers et votre vitrine.",
];
