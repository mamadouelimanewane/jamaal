/**
 * Protocole de partenariat signé à l'inscription. Le texte est modifiable dans le back-office
 * (Admin > Protocole) ; chaque modification crée une nouvelle version, à signer de nouveau.
 * Mise en forme légère : « ## » = titre d'article, « - » ou « 1. » = liste.
 * Champs remplis automatiquement : {nom} {piece} {adresse} {telephone} {code_parrain}.
 * Pur (utilisable partout).
 */

export interface ProtocolDoc {
  version: number;
  text: string;
  updatedAt: string | null;
}

export const DEFAULT_PROTOCOL_TEXT = `## Entre les soussignés

JAMAAL Luxury Cosmetics, [forme juridique], au capital de [montant] FCFA, immatriculée au RCCM de Dakar sous le n° [...], NINEA [...], dont le siège est situé [adresse], représentée par [nom et qualité], ci-après « JAMAAL »,

et

le Partenaire : {nom}, titulaire de la pièce d'identité {piece}, demeurant {adresse}, joignable au {telephone}, inscrit avec le code de parrainage {code_parrain}, ci-après « le Partenaire ».

## Préambule

JAMAAL est revendeur officiel de la marque CHOGAN (Italie) au Sénégal. Elle commercialise les parfums, soins, produits de maquillage, d'entretien et de bien-être CHOGAN par son site et par un réseau de partenaires indépendants.

Le Partenaire souhaite rejoindre ce réseau pour vendre ces produits à sa clientèle et, selon son rang, animer une équipe. Les parties ont donc convenu de ce qui suit.

## Article 1 — Objet

Le présent protocole définit les conditions dans lesquelles le Partenaire vend les produits distribués par JAMAAL et perçoit des commissions sur ces ventes et, le cas échéant, sur celles de son équipe.

## Article 2 — Statut indépendant

Le Partenaire agit en son nom propre, en toute indépendance. Il n'est ni salarié, ni mandataire, ni associé de JAMAAL ; aucun lien de subordination n'existe entre eux.

Il organise librement son activité (horaires, lieux, méthodes de vente). Il reste seul responsable de ses obligations fiscales et sociales, notamment de la déclaration de ses revenus.

## Article 3 — Adhésion et vérification d'identité

1. L'adhésion se fait en ligne avec le code de parrainage d'un Leader ou d'un Parrain actif.
2. Le Partenaire fournit son adresse, le numéro et une photo recto verso de sa pièce d'identité en cours de validité. Il certifie l'exactitude de ces informations.
3. Il lit le présent protocole et le signe à l'écran.
4. JAMAAL vérifie le dossier et accepte ou refuse l'adhésion, sans avoir à motiver un refus. L'adhésion prend effet à l'activation du compte.

L'adhésion est gratuite : aucun droit d'entrée, aucun achat minimum ni stock obligatoire n'est exigé pour devenir Partenaire. Le Partenaire doit être majeur.

## Article 4 — Rangs dans le réseau

Le réseau compte trois rangs, attribués et modifiés par JAMAAL seule (promotion ou rétrogradation), selon l'activité et le comportement du Partenaire.

- Leader : anime une équipe de Parrains.
- Parrain : rattaché à un Leader, anime une équipe de Consultants.
- Consultant : vendeur final, rattaché à un Parrain ; il ne recrute pas.

## Article 5 — Équipes et limites

Un Leader compte au plus 10 Parrains et un Parrain au plus 20 Consultants. JAMAAL peut modifier ces limites en informant les Partenaires.

Le Partenaire qui recrute s'engage à présenter l'activité honnêtement : il ne promet aucun revenu garanti et ne fait payer aucune somme à une recrue.

## Article 6 — Retrait d'une équipe

Un Leader ou un Parrain peut retirer un membre de son équipe ; JAMAAL peut aussi déplacer un membre. Le membre retiré devient libre et peut rejoindre une autre équipe avec le code de son nouveau responsable.

Les commissions déjà acquises restent dues à chacun. Seules les ventes réalisées après le changement suivent la nouvelle équipe.

## Article 7 — Prix et ventes

Les produits sont vendus aux prix publics fixés par JAMAAL et affichés sur son site. Le Partenaire ne peut pas les augmenter ; une remise n'est possible qu'avec un code promotionnel JAMAAL.

Les commandes passent par la plateforme JAMAAL (lien personnel du Partenaire ou saisie dans son espace). Le paiement est encaissé par JAMAAL (Wave, Orange Money, ou à la livraison) ; le Partenaire n'encaisse aucune somme pour le compte de JAMAAL, sauf accord écrit.

## Article 8 — Commissions et primes

Les commissions sont calculées sur le prix de vente des produits, hors frais de livraison, une fois la commande payée (ou livrée et encaissée pour un paiement à la livraison). Taux en vigueur à la signature :

- Vente d'un Consultant : 18 % au Consultant, 3 % à son Parrain, 3 % au Leader.
- Vente d'un Parrain : 18 % au Parrain, 6 % au Leader.
- Vente d'un Leader : 18 % au Leader.

Une commande annulée, remboursée ou retournée n'ouvre pas droit à commission ; une commission déjà versée sur une telle commande est déduite des versements suivants.

JAMAAL peut proposer des primes mensuelles (ventes personnelles) et des primes d'équipe (Leader et Parrain), selon des paliers publiés dans l'espace du Partenaire. Une prime n'est due que si elle est annoncée pour le mois concerné.

JAMAAL peut modifier les taux et les primes pour l'avenir, après en avoir informé les Partenaires au moins 30 jours à l'avance ; les ventes déjà réalisées gardent les taux applicables à leur date.

## Article 9 — Versements

Les commissions sont versées sur le compte Wave ou Orange Money déclaré par le Partenaire, à son nom. Le Partenaire garantit que ce compte lui appartient et signale tout changement.

Un versement peut attendre qu'un montant minimal soit atteint. Le Partenaire suit en temps réel ses gains, ses versements et leur état dans son espace. Un versement envoyé sur le numéro déclaré libère JAMAAL.

## Article 10 — Engagements du Partenaire

1. Présenter les produits de manière loyale, sans allégation de santé ou d'efficacité non prévue par la fiche produit.
2. Présenter les parfums comme des créations « inspirées de » grandes marques, jamais comme des produits de ces marques.
3. Respecter les clients : informations exactes, suivi des commandes, transmission rapide des réclamations à JAMAAL.
4. Ne pas revendre les produits sur d'autres plateformes ou boutiques sans accord écrit de JAMAAL.
5. Respecter les lois en vigueur au Sénégal.

## Article 11 — Image de marque

Les noms JAMAAL et CHOGAN, les logos et les visuels restent la propriété de leurs titulaires. Le Partenaire peut utiliser ceux fournis dans son kit marketing, pour la seule promotion des produits, sans les modifier.

Il ne se présente ni comme salarié ni comme représentant exclusif de JAMAAL ou de CHOGAN, et ne crée aucun site, page ou compte au nom de JAMAAL sans accord écrit.

## Article 12 — Données personnelles

JAMAAL traite les données du Partenaire (identité, pièce d'identité, coordonnées, numéro de versement, ventes) pour gérer son adhésion, calculer et verser ses commissions et respecter ses obligations légales, conformément à la loi n° 2008-12 sur la protection des données à caractère personnel.

- La photo de la pièce d'identité est conservée de façon privée, visible des seuls administrateurs JAMAAL.
- Le Partenaire peut accéder à ses données, les faire corriger ou supprimer à la fin du partenariat, sous réserve des durées de conservation légales, en écrivant à [adresse e-mail].
- Les données des clients que le Partenaire connaît par son activité ne servent qu'au suivi de leurs commandes ; il ne les cède à personne.

## Article 13 — Confidentialité

Le Partenaire garde confidentiels les prix d'achat, marges, conditions commerciales et données du réseau dont il a connaissance, pendant le partenariat et 2 ans après.

## Article 14 — Durée

Le protocole est conclu pour une durée indéterminée à compter de l'activation du compte du Partenaire.

## Article 15 — Résiliation

- Le Partenaire peut y mettre fin à tout moment, par message écrit à JAMAAL, avec un préavis de 15 jours.
- JAMAAL peut y mettre fin avec le même préavis, ou sans préavis en cas de faute grave : fausse identité, fraude, dénigrement, vente hors prix ou hors plateforme, atteinte à l'image de marque, non-respect répété du protocole.
- À la fin du partenariat, les commissions acquises sur les ventes payées avant cette date restent versées ; aucune autre indemnité n'est due. Le compte est désactivé et l'équipe du Partenaire est rattachée à un autre responsable choisi par JAMAAL.

## Article 16 — Droit applicable et litiges

Le protocole est soumis au droit sénégalais et aux Actes uniformes de l'OHADA. Les parties cherchent d'abord un accord amiable dans un délai de 30 jours ; à défaut, le litige est porté devant le Tribunal de commerce de Dakar.

## Article 17 — Signature électronique

Le Partenaire signe ce protocole à l'écran. Sa signature, la date et l'heure, la version du texte et son identité sont enregistrées et reprises dans un exemplaire PDF que les deux parties peuvent télécharger.

Les parties reconnaissent à cette signature et à cet exemplaire la même valeur qu'un original papier signé, conformément à la loi n° 2008-08 sur les transactions électroniques. Toute nouvelle version du protocole est soumise à une nouvelle signature.`;

export const DEFAULT_PROTOCOL: ProtocolDoc = { version: 1, text: DEFAULT_PROTOCOL_TEXT, updatedAt: null };

export function normalizeProtocol(raw: unknown): ProtocolDoc {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = typeof r.text === "string" && r.text.trim().length >= 200 ? r.text.trim().slice(0, 60_000) : DEFAULT_PROTOCOL_TEXT;
  const version = Number.isInteger(r.version) && (r.version as number) > 0 ? (r.version as number) : 1;
  return { version, text, updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null };
}

export interface SignerFields {
  nom: string;
  piece: string;
  adresse: string;
  telephone: string;
  code_parrain: string;
}

const EMPTY = "………………";

/** Remplace les champs {nom}, {piece}… par les informations du signataire. */
export function fillProtocol(text: string, f: Partial<SignerFields>): string {
  return text.replace(/\{(nom|piece|adresse|telephone|code_parrain)\}/g, (_, k: keyof SignerFields) => (f[k] ?? "").trim() || EMPTY);
}

export type ProtocolBlock = { kind: "h" | "p" | "li" | "ol"; text: string; n?: number };

/** Découpe le texte en blocs (titre, paragraphe, puce, numéro) pour l'affichage et le PDF. */
export function protocolBlocks(text: string): ProtocolBlock[] {
  const out: ProtocolBlock[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split(/\n{2,}|\n(?=## |- |\d+\. )/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) out.push({ kind: "h", text: line.slice(3).trim() });
    else if (line.startsWith("- ")) out.push({ kind: "li", text: line.slice(2).trim() });
    else if (/^\d+\.\s/.test(line)) out.push({ kind: "ol", text: line.replace(/^\d+\.\s+/, ""), n: Number(line.match(/^\d+/)![0]) });
    else out.push({ kind: "p", text: line.replace(/\n/g, " ") });
  }
  return out;
}

export const ID_TYPES = { CNI: "Carte nationale d'identité", PASSEPORT: "Passeport", CEDEAO: "Carte d'identité CEDEAO" } as const;
export type IdType = keyof typeof ID_TYPES;
export const isIdType = (v: unknown): v is IdType => typeof v === "string" && v in ID_TYPES;
export const pieceLabel = (type: string | null | undefined, num: string | null | undefined) =>
  num ? `${isIdType(type) ? ID_TYPES[type] : "Pièce"} n° ${num}` : "";
