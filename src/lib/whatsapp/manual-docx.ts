import { crc32, deflateRawSync } from "node:zlib";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Empaqueteur ZIP minimaliste en pur Node.js pour générer une archive OpenXML (.docx) valide.
 */
function buildZipArchive(files: { name: string; content: string | Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const rawBuf = typeof file.content === "string" ? Buffer.from(file.content, "utf8") : file.content;
    const compressed = deflateRawSync(rawBuf);
    const crc = crc32(rawBuf) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(8, 8); // deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function wTitle(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="160"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="16233A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wSubtitle(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="4B5563"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wH1(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="320" w:after="140"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="16233A"/></w:pBdr></w:pPr><w:r><w:rPr><w:b/><w:color w:val="16233A"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wH2(text: string): string {
  return `<w:p><w:pPr><w:spacing w:before="220" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1F9D55"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wPara(text: string, opts: { boldPrefix?: string; shade?: string; color?: string } = {}): string {
  const shd = opts.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>` : "";
  const color = opts.color ?? "1F2937";
  const prefixRun = opts.boldPrefix
    ? `<w:r><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${escapeXml(opts.boldPrefix)} </w:t></w:r>`
    : "";
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="100"/>${shd}</w:pPr>${prefixRun}<w:r><w:rPr><w:color w:val="${color}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wBullet(boldLabel: string, text: string): string {
  return `<w:p><w:pPr><w:ind w:left="360"/><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="16233A"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">• ${escapeXml(boldLabel)} : </w:t></w:r><w:r><w:rPr><w:color w:val="1F2937"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wTable(headers: string[], rows: string[][]): string {
  const headerCells = headers
    .map(
      (h) =>
        `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="16233A"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p></w:tc>`,
    )
    .join("");

  const bodyRows = rows
    .map((row, rIdx) => {
      const fill = rIdx % 2 === 0 ? "FFFFFF" : "F8F6F2";
      const cells = row
        .map(
          (cell, cIdx) =>
            `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr>${cIdx === 0 ? "<w:b/>" : ""}<w:color w:val="16233A"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`,
        )
        .join("");
      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/></w:tblBorders></w:tblPr><w:tr>${headerCells}</w:tr>${bodyRows}</w:tbl>`;
}

/**
 * Génère le fichier Microsoft Word (.docx) officiel du Manuel Messagerie & Notifications WhatsApp JAMAAL Luxury.
 */
export function buildWhatsAppManualDocx(): Buffer {
  const bodyXml = [
    wTitle("MANUEL OFFICIEL — MESSAGERIE & NOTIFICATIONS WHATSAPP JAMAAL LUXURY"),
    wSubtitle(
      "Guide opérationnel distinguant la Voie 1 « API Cloud Officielle (+221 71 180 09 09 · Meta / KwingoChat) » et la Voie 2 « WhatsApp P2P Personnel (Mobile / PC) »",
    ),

    wH1("1. Distinction fondamentale : Voie API Cloud vs Voie WhatsApp P2P"),
    wPara(
      "La plateforme JAMAAL Luxury combine deux voies WhatsApp complémentaires afin d'allier la puissance d'automatisation du numéro Business officiel et la proximité humaine des parrains et consultants.",
    ),
    wTable(
      ["Critère", "Voie 1 : API Cloud Officielle (+221 71 180 09 09)", "Voie 2 : WhatsApp P2P (Mobile / PC Personnel)"],
      [
        [
          "Expéditeur affiché",
          "Compte officiel JAMAAL Luxury (+221 71 180 09 09)",
          "Numéro WhatsApp personnel du Parrain / Consultant (ou de l'admin)",
        ],
        [
          "Mode d'envoi",
          "Envoi direct en 1 clic dans JAMAAL ou automatique en arrière-plan",
          "Ouvre l'application WhatsApp sur Mobile ou PC avec le texte pré-rempli (wa.me)",
        ],
        [
          "Règle Meta des 24 heures",
          "OUI : Texte libre autorisé uniquement si le client a écrit depuis < 24 h. Hors 24 h : Modèle approuvé Meta obligatoire",
          "NON : Aucune limite de 24 h, message 100 % libre à tout moment",
        ],
        [
          "Modèles utilisables",
          "Modèles approuvés par Meta (APPROVED : test_lancement_produit, test_jamaal, test_appointement, test_san_param)",
          "Textes rapides internes JAMAAL + tout texte libre personnalisé",
        ],
        [
          "Qui peut l'utiliser hors 24 h ?",
          "Strictement réservé aux Administrateurs (modèles Cloud & campagnes)",
          "Parrains, Consultants et Administrateurs",
        ],
        [
          "Traçabilité",
          "Enregistré dans la conversation JAMAAL, KwingoChat et le Journal WhatsApp (ENVOYE, LIVRE, LU, ECHEC)",
          "Échange poursuivi en direct dans l'application WhatsApp de l'appareil",
        ],
      ],
    ),

    wH1("2. Matrice complète des flux et notifications WhatsApp"),
    wTable(
      ["Fonctionnalité / Notification", "Voie utilisée", "Règle d'envoi & Routage"],
      [
        [
          "1. Messages entrants des clients au +221 71 180 09 09",
          "Voie 1 : API Cloud",
          "Synchronisés depuis KwingoChat et routés automatiquement vers l'inbox du consultant du client (ROUTAGE_CLIENT, LIEN_BOUTIQUE, CAMPAGNE) ou maintenus dans Non assignés (unassigned).",
        ],
        [
          "2. Formulaire Contact du site public (/contact)",
          "Voie 1 : API Cloud",
          "Crée ou alimente la conversation dans la Messagerie WhatsApp JAMAAL, la rattache au consultant du client et alerte l'équipe par WhatsApp Cloud API.",
        ],
        [
          "3. Réponse à un client dans la fenêtre < 24 h",
          "Voie 1 (API Cloud) OU Voie 2 (P2P)",
          "Double choix dans l'inbox : bouton vert « Répondre ici (API Cloud · 24h) » ou bouton « Répondre avec mon WhatsApp personnel (Mobile / PC) ».",
        ],
        [
          "4. Réponse à un client hors fenêtre > 24 h",
          "Voie 2 (P2P Consultant) / Voie 1 (API Cloud Admin)",
          "Pour le Parrain/Consultant : réponse uniquement via son WhatsApp personnel (P2P). Pour l'Admin : envoi possible par Modèle approuvé Meta via l'API Cloud.",
        ],
        [
          "5. Campagnes WhatsApp & Import Excel (/admin/whatsapp/campagnes)",
          "Voie 1 : API Cloud (Admin)",
          "Choix obligatoire d'un modèle approuvé Meta + ciblage par filtres base JAMAAL et/ou fichier Excel (.xlsx, .csv). Les retours clients sont auto-assignés à leur consultant.",
        ],
        [
          "6. Annonces générales aux consultants (/admin/annonces)",
          "Voie 1 : API Cloud + Notification interne",
          "Publiées dans « Ma communication » + cloche interne + diffusées sur WhatsApp via l'API Cloud JAMAAL Luxury.",
        ],
        [
          "7. Annonces ciblées par statistiques (/admin/boutiques-stats)",
          "Notification interne + Voie 2 : P2P",
          "Message personnalisé ({prenom}, {ventes}, {visiteurs}) publié dans l'espace revendeur + boutons d'ouverture directe WhatsApp P2P.",
        ],
        [
          "8. Notifications automatiques (Commandes, Livreur, Relances, Kit du matin)",
          "Voie 1 : API Cloud",
          "Envoyées automatiquement par la passerelle API Cloud JAMAAL Luxury (avec repli automatique sur un modèle Meta approuvé si la fenêtre 24 h est fermée).",
        ],
        [
          "9. Boutons « Commander sur WhatsApp » sur le site",
          "Voie 2 (P2P) vers Voie 1 (API Cloud)",
          "Le client ouvre son WhatsApp vers +221 71 180 09 09 : dès qu'il envoie son message, une fenêtre gratuite de 24 h s'ouvre côté API Cloud.",
        ],
      ],
    ),

    wH1("3. Guide Parrain & Consultant — Mon Inbox (/admin/mon-inbox)"),
    wPara("URL d'accès Production : https://www.jamaal.sn/admin/mon-inbox", { boldPrefix: "Accès :" }),
    wH2("3.1. Origine des conversations dans votre boîte de réception"),
    wBullet(
      "Retours campagne (CAMPAGNE)",
      "Un de vos clients a répondu à une campagne WhatsApp envoyée par l'administrateur ; sa réponse arrive directement dans votre Inbox.",
    ),
    wBullet(
      "Client rattaché (ROUTAGE_CLIENT)",
      "Un client ayant déjà commandé avec vous (ou rattaché à votre fiche client, panier abandonné, abonnement, carte cadeau ou parrainage) a écrit au +221 71 180 09 09.",
    ),
    wBullet(
      "Lien boutique (LIEN_BOUTIQUE)",
      "Un prospect a envoyé un message contenant le lien ou le code de votre boutique personnelle (/c/votre-slug).",
    ),
    wBullet(
      "Assigné par admin (MANUEL)",
      "Un administrateur vous a attribué manuellement la conversation.",
    ),

    wH2("3.2. Utiliser les Modèles de réponses rapides et les Commandes client"),
    wBullet(
      "Bouton repliable « Commandes client (N) »",
      "Situé en haut à droite de la conversation, il déplie la liste des commandes passées par ce numéro (montant, date, statut).",
    ),
    wBullet(
      "1. Modèles approuvés par Meta (Utilisables par API Cloud)",
      "Modèles officiels validés par Meta (test_lancement_produit, test_jamaal, test_appointement, test_san_param). Utilisables pour répondre via l'API Cloud comme via WhatsApp personnel.",
    ),
    wBullet(
      "2. Textes rapides internes JAMAAL (Non utilisables par API Cloud)",
      "Textes pré-remplis réservés au WhatsApp personnel (P2P). Lorsqu'un texte interne est sélectionné, un bandeau d'avertissement ambre s'affiche et le bouton API Cloud est automatiquement désactivé.",
    ),

    wH1("4. Guide Administrateur — Les 4 pages WhatsApp du Back-office"),
    wH2("Onglet 1 : Messagerie & Conversations (/admin/whatsapp/conversations)"),
    wBullet(
      "Supervision globale",
      "Visualisez toutes les conversations du numéro Business +221 71 180 09 09, filtrez par « Tous », « Non assignés (unassigned) » ou par Parrain/Consultant.",
    ),
    wBullet(
      "Attribution & Auto-routage",
      "Assignez manuellement un fil à un consultant via le menu déroulant ou cliquez sur « Auto-router ».",
    ),
    wBullet(
      "Envoi hors 24 h (exclusivité Admin)",
      "Lorsque la fenêtre de 24 h est fermée, seul l'administrateur dispose du bouton « Envoyer par modèle Cloud (Admin) ».",
    ),

    wH2("Onglet 2 : Campagnes, Brouillons & Import Excel (/admin/whatsapp/campagnes)"),
    wBullet(
      "Brouillons à la volée",
      "Créez autant de brouillons que souhaité (« + Enregistrer en brouillon » / « + Enregistrer comme nouveau brouillon »), puis utilisez les boutons « Lancer maintenant », « Modifier », « Dupliquer » ou « Supprimer » à la volée.",
    ),
    wBullet(
      "Étape 1 — Modèle approuvé par Meta",
      "Choisissez obligatoirement parmi les modèles Meta approuvés du compte Jamaal Luxury.",
    ),
    wBullet(
      "Étape 2 — Filtres JAMAAL et/ou Import Excel (.xlsx, .csv)",
      "Utilisez les filtres existants (Clients/Revendeurs, inactivité, catégorie, revendeur) et/ou téléversez un fichier Excel. Les numéros sont normalisés, dédoublonnés, les clients STOP sont exclus et chaque contact est rattaché à son consultant.",
    ),

    wH2("Onglet 3 : Centre & Modèles Meta (/admin/whatsapp)"),
    wBullet(
      "Cockpit & Modèles",
      "Retrouvez les 4 indicateurs clés cliquables, le catalogue des modèles approuvés par Meta avec bouton « Utiliser dans une campagne », l'export du Catalogue Produits CSV (Meta) et l'éditeur des textes des messages automatiques.",
    ),

    wH2("Onglet 4 : Journal & Diagnostic (/admin/journal-whatsapp)"),
    wBullet(
      "Supervision technique",
      "Consultez les compteurs des 7 derniers jours (Acceptés, Livrés/lus, En échec avec bouton Renvoyer, Simulés), envoyez un message de test et inspectez les 100 derniers messages entrants et sortants.",
    ),
  ].join("");

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return buildZipArchive([
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: relsXml },
    { name: "word/document.xml", content: documentXml },
  ]);
}
