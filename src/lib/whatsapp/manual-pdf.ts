import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function safeWinAnsi(s: string): string {
  return [
    ...s
      .replace(/\u202f|\u00a0/g, " ")
      .replace(/≤/g, "<=")
      .replace(/≥/g, ">=")
      .replace(/→/g, "->")
      .replace(/✓/g, "[OK]")
      .replace(/⚠️/g, "[!]")
      .replace(/☁️/g, "")
      .replace(/📱/g, ""),
  ]
    .map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(c) ? c : ""))
    .join("");
}

/**
 * Génère le Manuel Officiel PDF (A4) de la Messagerie & des Notifications WhatsApp JAMAAL Luxury
 * distinguant la Voie 1 (API Cloud +221 71 180 09 09) et la Voie 2 (WhatsApp P2P Mobile / PC).
 */
export async function buildWhatsAppManualPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Manuel Officiel — Messagerie & Notifications WhatsApp JAMAAL Luxury");
  doc.setAuthor("JAMAAL Luxury Cosmetics");
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const LW = W - 2 * M;

  const navy = rgb(0.09, 0.14, 0.23);
  const emerald = rgb(0.12, 0.62, 0.33);
  const amber = rgb(0.65, 0.38, 0.04);
  const grey = rgb(0.35, 0.38, 0.45);
  const lightCream = rgb(0.97, 0.96, 0.94);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  let pageNum = 1;

  const drawFooter = (p: PDFPage, num: number) => {
    p.drawText(
      safeWinAnsi(`JAMAAL Luxury (+221 71 180 09 09) — Manuel Messagerie & Notifications WhatsApp · Page ${num}`),
      { x: M, y: 24, size: 8, font, color: grey },
    );
  };

  drawFooter(page, pageNum);

  const newPage = () => {
    page = doc.addPage([W, H]);
    pageNum += 1;
    y = H - M;
    drawFooter(page, pageNum);
  };

  const wrapLines = (text: string, f: PDFFont, size: number, maxWidth: number): string[] => {
    const out: string[] = [];
    for (const para of safeWinAnsi(text).split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) <= maxWidth) {
          cur = candidate;
        } else {
          if (cur) out.push(cur);
          cur = word;
        }
      }
      if (cur) out.push(cur);
    }
    return out.length ? out : [""];
  };

  const writeText = (
    text: string,
    opts: {
      f?: PDFFont;
      size?: number;
      indent?: number;
      color?: ReturnType<typeof rgb>;
      gap?: number;
      prefix?: string;
    } = {},
  ) => {
    const f = opts.f ?? font;
    const size = opts.size ?? 9.5;
    const indent = opts.indent ?? 0;
    const lh = size * 1.42;
    const ls = wrapLines(text, f, size, LW - indent);

    ls.forEach((line, idx) => {
      if (y - lh < M) newPage();
      y -= lh;
      if (idx === 0 && opts.prefix) {
        page.drawText(safeWinAnsi(opts.prefix), {
          x: M + indent - 12,
          y,
          size,
          font: bold,
          color: opts.color ?? navy,
        });
      }
      page.drawText(line, {
        x: M + indent,
        y,
        size,
        font: f,
        color: opts.color ?? navy,
      });
    });
    y -= opts.gap ?? 4;
  };

  const writeSectionHeader = (title: string) => {
    if (y - 45 < M) newPage();
    y -= 10;
    page.drawRectangle({
      x: M,
      y: y - 18,
      width: LW,
      height: 22,
      color: navy,
    });
    page.drawText(safeWinAnsi(title), {
      x: M + 10,
      y: y - 12,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y -= 28;
  };

  const writeSubHeader = (title: string, color = emerald) => {
    if (y - 28 < M) newPage();
    y -= 6;
    writeText(title, { f: bold, size: 10.5, color, gap: 3 });
  };

  const writeComparisonRow = (label: string, cloudText: string, p2pText: string) => {
    const col1W = 115;
    const col2W = (LW - col1W) / 2 - 6;
    const col3W = col2W;

    const l1 = wrapLines(label, bold, 8.5, col1W - 8);
    const l2 = wrapLines(cloudText, font, 8.5, col2W - 8);
    const l3 = wrapLines(p2pText, font, 8.5, col3W - 8);
    const maxLines = Math.max(l1.length, l2.length, l3.length);
    const rowH = maxLines * 11.5 + 10;

    if (y - rowH < M) newPage();

    page.drawRectangle({
      x: M,
      y: y - rowH,
      width: LW,
      height: rowH,
      color: lightCream,
      borderColor: rgb(0.86, 0.85, 0.82),
      borderWidth: 0.6,
    });

    l1.forEach((line, i) => {
      page.drawText(line, { x: M + 6, y: y - 13 - i * 11.5, size: 8.5, font: bold, color: navy });
    });
    l2.forEach((line, i) => {
      page.drawText(line, { x: M + col1W + 4, y: y - 13 - i * 11.5, size: 8.5, font, color: navy });
    });
    l3.forEach((line, i) => {
      page.drawText(line, { x: M + col1W + col2W + 10, y: y - 13 - i * 11.5, size: 8.5, font, color: navy });
    });

    y -= rowH + 4;
  };

  // En-tête du document
  writeText("JAMAAL LUXURY COSMETICS · DOCUMENTATION OFFICIELLE", {
    f: bold,
    size: 8.5,
    color: emerald,
    gap: 2,
  });
  writeText("Manuel Messagerie & Notifications WhatsApp", {
    f: bold,
    size: 18,
    color: navy,
    gap: 3,
  });
  writeText(
    "Architecture hybride distinguant la Voie 1 « API Cloud Officielle (+221 71 180 09 09 · Meta / KwingoChat) » et la Voie 2 « WhatsApp P2P Personnel (Mobile / PC) ».",
    { size: 9.5, color: grey, gap: 10 },
  );

  // SECTION 1
  writeSectionHeader("1. DISTINCTION FONDAMENTALE : VOIE API CLOUD vs VOIE WHATSAPP P2P");
  writeComparisonRow(
    "CRITÈRE",
    "VOIE 1 : API CLOUD (+221 71 180 09 09)",
    "VOIE 2 : WHATSAPP P2P (MOBILE / PC)",
  );
  writeComparisonRow(
    "Expéditeur affiché",
    "Compte officiel JAMAAL Luxury (+221 71 180 09 09)",
    "Numéro WhatsApp personnel du Parrain / Consultant (ou de l'admin)",
  );
  writeComparisonRow(
    "Mode d'envoi",
    "Envoi direct en 1 clic depuis l'interface JAMAAL ou automatique en arrière-plan",
    "Ouvre l'application WhatsApp sur Mobile ou PC avec le texte pré-rempli (wa.me)",
  );
  writeComparisonRow(
    "Règle Meta des 24 h",
    "OUI : texte libre autorisé si le client a écrit depuis < 24 h. Hors 24 h : Modèle approuvé Meta obligatoire",
    "NON : aucune limite de 24 h, message 100 % libre à tout moment",
  );
  writeComparisonRow(
    "Modèles utilisables",
    "Uniquement les Modèles approuvés par Meta (APPROVED : test_lancement_produit, test_jamaal, test_appointement, test_san_param)",
    "Textes rapides internes JAMAAL + tout texte libre personnalisé",
  );
  writeComparisonRow(
    "Droits hors 24 h",
    "Strictement réservé aux Administrateurs (modèles Cloud & campagnes)",
    "Parrains, Consultants et Administrateurs",
  );
  writeComparisonRow(
    "Traçabilité",
    "Journalisé dans la conversation JAMAAL, KwingoChat et le Journal WhatsApp (ENVOYE, LIVRE, LU, ECHEC)",
    "Conversation poursuivie directement sur le WhatsApp de l'appareil du conseiller",
  );

  // SECTION 2
  writeSectionHeader("2. MATRICE COMPLÈTE DES FLUX ET NOTIFICATIONS WHATSAPP");
  const flows = [
    [
      "1. Messages entrants des clients au +221 71 180 09 09 [Voie 1 : API Cloud]",
      "Synchronisés depuis KwingoChat et routés automatiquement vers l'inbox du parrain/consultant du client (ROUTAGE_CLIENT, LIEN_BOUTIQUE, CAMPAGNE) ou maintenus dans Non assignés (unassigned).",
    ],
    [
      "2. Formulaire « Contact » du site public (/contact) [Voie 1 : API Cloud]",
      "Crée ou alimente immédiatement une conversation dans la Messagerie WhatsApp JAMAAL, la rattache au consultant du client et alerte l'équipe par WhatsApp Cloud API.",
    ],
    [
      "3. Réponse à un client dans la fenêtre < 24 h [Voie 1 API Cloud OU Voie 2 P2P]",
      "Double choix dans l'inbox : bouton vert « Répondre ici (API Cloud · 24h) » ou bouton « Répondre avec mon WhatsApp personnel (Mobile / PC) ».",
    ],
    [
      "4. Réponse à un client hors fenêtre > 24 h [Voie 2 P2P Consultant / Voie 1 API Cloud Admin]",
      "Parrain / Consultant : réponse uniquement via son WhatsApp personnel (P2P). Administrateur : envoi possible par Modèle approuvé Meta via l'API Cloud ou en P2P.",
    ],
    [
      "5. Campagnes WhatsApp & Import Excel (/admin/whatsapp/campagnes) [Voie 1 : API Cloud Admin]",
      "Choix obligatoire d'un modèle approuvé Meta + ciblage par filtres base JAMAAL et/ou fichier Excel (.xlsx, .csv). Les retours clients sont auto-assignés à leur consultant.",
    ],
    [
      "6. Annonces générales aux consultants (/admin/annonces) [Voie 1 : API Cloud + Interne]",
      "Publiées dans « Ma communication » + cloche interne + diffusées sur WhatsApp via l'API Cloud JAMAAL Luxury.",
    ],
    [
      "7. Annonces ciblées par statistiques (/admin/boutiques-stats) [Interne + Voie 2 : P2P]",
      "Message personnalisé ({prenom}, {ventes}, {visiteurs}) publié dans l'espace revendeur + boutons d'ouverture directe WhatsApp P2P par revendeur.",
    ],
    [
      "8. Notifications automatiques (Commandes, Livreur, Relances, Kit du matin) [Voie 1 : API Cloud]",
      "Envoyées automatiquement par la passerelle API Cloud JAMAAL Luxury (avec repli sur un modèle Meta approuvé si la fenêtre 24 h est fermée).",
    ],
    [
      "9. Boutons « Commander sur WhatsApp » sur le site [Voie 2 P2P -> Voie 1 API Cloud]",
      "Le client ouvre son WhatsApp vers +221 71 180 09 09 : dès qu'il envoie son message, une fenêtre gratuite de 24 h s'ouvre côté API Cloud.",
    ],
  ];

  for (const [title, desc] of flows) {
    writeText(title, { f: bold, size: 9.2, color: navy, gap: 1 });
    writeText(desc, { size: 8.8, indent: 12, color: grey, gap: 5 });
  }

  // SECTION 3
  writeSectionHeader("3. GUIDE PARRAIN & CONSULTANT — MON INBOX (/admin/mon-inbox)");
  writeSubHeader("3.1. Origine des conversations dans votre boîte de réception");
  writeText(
    "Retours campagne (CAMPAGNE) : un de vos clients a répondu à une campagne WhatsApp envoyée par l'administrateur ; sa réponse arrive directement dans votre Inbox.",
    { indent: 14, prefix: "•", size: 9 },
  );
  writeText(
    "Client rattaché (ROUTAGE_CLIENT) : un client ayant déjà commandé avec vous (ou rattaché à votre fiche client, panier abandonné, abonnement, carte cadeau ou parrainage) a écrit au +221 71 180 09 09.",
    { indent: 14, prefix: "•", size: 9 },
  );
  writeText(
    "Lien boutique (LIEN_BOUTIQUE) : un prospect a envoyé un message contenant le lien ou le code de votre boutique personnelle (/c/votre-slug).",
    { indent: 14, prefix: "•", size: 9 },
  );
  writeText(
    "Assigné par admin (MANUEL) : un administrateur vous a attribué manuellement la conversation.",
    { indent: 14, prefix: "•", size: 9 },
  );

  writeSubHeader("3.2. Utiliser les Modèles de réponses rapides et les Commandes client");
  writeText(
    "Bouton repliable « Commandes client (N) » : situé en haut à droite de la conversation, il déplie la liste des commandes passées par ce numéro (montant, date, statut).",
    { indent: 14, prefix: "•", size: 9 },
  );
  writeText(
    "1. Modèles approuvés par Meta (Utilisables par API Cloud) : modèles officiels validés par Meta (test_lancement_produit, test_jamaal, test_appointement, test_san_param). Utilisables pour répondre via l'API Cloud comme via WhatsApp personnel.",
    { indent: 14, prefix: "•", size: 9 },
  );
  writeText(
    "2. Textes rapides internes JAMAAL (Non utilisables par API Cloud) : textes pré-remplis réservés au WhatsApp personnel (P2P). Lorsqu'un texte interne est sélectionné, un bandeau d'avertissement s'affiche et le bouton API Cloud est désactivé.",
    { indent: 14, prefix: "•", size: 9, color: amber },
  );

  // SECTION 4
  writeSectionHeader("4. GUIDE ADMINISTRATEUR — LES 5 ONGLETS WHATSAPP DU BACK-OFFICE");
  writeSubHeader("Onglet 1 : Messagerie & Conversations (/admin/whatsapp/conversations)");
  writeText(
    "Supervision globale de toutes les conversations du numéro Business +221 71 180 09 09, filtrage par « Tous », « Non assignés (unassigned) » ou par Parrain/Consultant, attribution manuelle ou auto-routage, et envoi par modèle Cloud hors 24 h.",
    { size: 9, gap: 5 },
  );

  writeSubHeader("Onglet 2 : Campagnes, Brouillons & Import Excel (/admin/whatsapp/campagnes)");
  writeText(
    "Création d'un nombre illimité de brouillons avec actions à la volée (Lancer maintenant, Modifier, Dupliquer, Supprimer). Choix obligatoire d'un modèle approuvé Meta + ciblage par filtres JAMAAL et/ou import d'un fichier Excel (.xlsx, .csv).",
    { size: 9, gap: 5 },
  );

  writeSubHeader("Onglet 3 : Centre & Modèles Meta (/admin/whatsapp)");
  writeText(
    "Cockpit de synthèse avec 4 cartes KPI cliquables, répertoire des modèles approuvés par Meta synchronisés en direct depuis KwingoChat, export du Catalogue Produits CSV (Meta) et éditeur des textes des messages automatiques.",
    { size: 9, gap: 5 },
  );

  writeSubHeader("Onglet 4 : Journal & Diagnostic (/admin/journal-whatsapp)");
  writeText(
    "Diagnostic des 7 derniers jours (Acceptés, Livrés/lus, En échec avec bouton Renvoyer, Simulés), envoi d'un message de test rapide et historique des 100 derniers messages entrants et sortants.",
    { size: 9, gap: 5 },
  );

  writeSubHeader("Onglet 5 : Guide & Manuel (/admin/whatsapp/manuel)");
  writeText(
    "Synthèse interactive et téléchargement PDF du présent manuel opérationnel.",
    { size: 9, gap: 5 },
  );

  return doc.save();
}
