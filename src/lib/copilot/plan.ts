/**
 * « Copilote de vente » du matin : les 5 actions du jour d'un consultant, chacune avec son message déjà
 * rédigé (pur, testé). Priorités : anniversaires, paniers abandonnés, clients à relancer, filleul à aider ;
 * le produit du jour complète s'il reste de la place.
 */
export type ActionType = "anniversaire" | "panier" | "relance" | "filleul" | "statut";

export type CopilotAction = {
  type: ActionType;
  /** Clé stable (évite de reproposer la même action) */
  key: string;
  title: string;
  detail: string;
  /** Destinataire (chiffres, format international) ; absent pour le statut */
  phone: string | null;
  message: string;
};

export type ClientOrder = { id: string; phone: string; name: string; createdAt: Date; products: string[]; productSlug: string | null };
export type BirthdayClient = { phone: string; name: string };
export type Cart = { id: string; phone: string; name: string | null; total: number; products: string[]; updatedAt: Date };
export type Filleul = { id: string; name: string; whatsapp: string; joinedAt: Date; lastSaleAt: Date | null; sales: number };
export type DayProduct = { name: string; slug: string };

export type CopilotInput = {
  consultant: { name: string; slug: string | null };
  origin: string;
  now: Date;
  orders: ClientOrder[];
  birthdays: BirthdayClient[];
  carts: Cart[];
  filleuls: Filleul[];
  product: DayProduct | null;
  /** Actions déjà proposées (clés) : on ne les repropose pas */
  done: Set<string>;
  /** Numéros qui ont répondu STOP */
  optedOut: Set<string>;
};

const DAY = 86_400_000;
export const RELANCE_MIN_DAYS = 35;
export const RELANCE_MAX_DAYS = 75;
export const MAX_ACTIONS = 5;

const first = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] || "";
const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^00/, "").slice(-9);
const intl = (p: string) => {
  const d = p.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 9 ? `221${d}` : d;
};
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;
const list = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);
const days = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY);

export function buildCopilotPlan(input: CopilotInput): CopilotAction[] {
  const { consultant, origin, now, done, optedOut } = input;
  const me = first(consultant.name);
  const ref = consultant.slug ? `?ref=${consultant.slug}` : "";
  const shop = consultant.slug ? `${origin}/c/${consultant.slug}` : origin;
  const out: CopilotAction[] = [];
  const seenPhones = new Set<string>();
  const ok = (key: string, phone: string | null) => !done.has(key) && (!phone || (!optedOut.has(phoneKey(phone)) && !seenPhones.has(phoneKey(phone))));
  const push = (a: CopilotAction) => {
    out.push(a);
    if (a.phone) seenPhones.add(phoneKey(a.phone));
  };

  // 1. Anniversaires du jour
  for (const b of input.birthdays) {
    const key = `anniv:${now.getUTCFullYear()}:${phoneKey(b.phone)}`;
    if (!ok(key, b.phone)) continue;
    push({
      type: "anniversaire",
      key,
      title: `🎂 Anniversaire de ${b.name}`,
      detail: "Souhaitez-lui un bon anniversaire, avec une idée cadeau.",
      phone: intl(b.phone),
      message: `Joyeux anniversaire ${first(b.name)} ! 🎉🎂 Je vous souhaite une très belle journée, pleine de joie. Pour l'occasion, faites-vous plaisir avec un parfum ou un soin JAMAAL : je vous conseille avec plaisir 🌸 ${shop}\n${me}, JAMAAL`,
    });
  }

  // 2. Paniers abandonnés (récents, pas encore commandés)
  for (const c of [...input.carts].sort((a, b) => b.total - a.total)) {
    const key = `panier:${c.id}`;
    if (!ok(key, c.phone)) continue;
    const prods = c.products.slice(0, 3);
    push({
      type: "panier",
      key,
      title: `🛒 Panier de ${c.name || "un client"} (${fcfa(c.total)})`,
      detail: `${list(prods)} — laissé il y a ${Math.max(1, days(now, c.updatedAt))} jour(s).`,
      phone: intl(c.phone),
      message: `Bonjour${c.name ? ` ${first(c.name)}` : ""} 🌸, c'est ${me} de JAMAAL. J'ai vu que vous aviez choisi ${list(prods) || "quelques produits"}. Avez-vous une question sur un parfum, la livraison ou le paiement ? Je peux finaliser la commande avec vous ici, en 2 minutes 😊 ${shop}`,
    });
  }

  // 3. Clients à relancer : dernier achat entre 35 et 75 jours
  const lastByPhone = new Map<string, ClientOrder>();
  for (const o of input.orders) {
    const k = phoneKey(o.phone);
    if (!k) continue;
    const cur = lastByPhone.get(k);
    if (!cur || o.createdAt > cur.createdAt) lastByPhone.set(k, o);
  }
  const due = [...lastByPhone.values()]
    .map((o) => ({ o, age: days(now, o.createdAt) }))
    .filter((x) => x.age >= RELANCE_MIN_DAYS && x.age <= RELANCE_MAX_DAYS)
    .sort((a, b) => a.age - b.age);
  for (const { o, age } of due) {
    const key = `relance:${o.id}`;
    if (!ok(key, o.phone)) continue;
    const prod = o.products[0] ?? "votre parfum";
    const link = o.productSlug ? `${origin}/produits/${o.productSlug}${ref}` : shop;
    push({
      type: "relance",
      key,
      title: `🔁 Relancer ${o.name}`,
      detail: `A acheté ${list(o.products.slice(0, 2)) || "chez vous"} il y a ${age} jours.`,
      phone: intl(o.phone),
      message: `Bonjour ${first(o.name)} 🌸, c'est ${me} de JAMAAL. Comment trouvez-vous ${prod} ? Il doit bientôt toucher à sa fin : je vous en remets un, ou vous voulez découvrir une autre senteur ? Je vous le fais livrer 😊 ${link}`,
    });
  }

  // 4. Un filleul à aider : sans vente depuis 14 jours (ou jamais)
  const filleul = input.filleuls
    .map((f) => ({ f, idle: f.lastSaleAt ? days(now, f.lastSaleAt) : days(now, f.joinedAt) }))
    .filter((x) => x.idle >= 14 || (x.f.sales === 0 && days(now, x.f.joinedAt) >= 3))
    .sort((a, b) => b.idle - a.idle)[0];
  if (filleul) {
    const week = Math.floor(now.getTime() / (7 * DAY));
    const key = `filleul:${week}:${filleul.f.id}`;
    if (ok(key, filleul.f.whatsapp)) {
      const never = filleul.f.sales === 0;
      push({
        type: "filleul",
        key,
        title: `🤝 Aider ${filleul.f.name}`,
        detail: never ? `Votre filleul n'a pas encore fait sa première vente (inscrit il y a ${days(now, filleul.f.joinedAt)} jours).` : `Pas de vente depuis ${filleul.idle} jours.`,
        phone: intl(filleul.f.whatsapp),
        message: never
          ? `Salut ${first(filleul.f.name)} 👋 c'est ${me}. Comment ça se passe chez JAMAAL ? Pour ta première vente, le plus simple : publie le produit du jour en statut (Mon marketing › Partager) et envoie le lien à 5 proches. On en parle 10 minutes aujourd'hui ? 💪`
          : `Salut ${first(filleul.f.name)} 👋 c'est ${me}. Ça fait un moment, tout va bien ? Pense à relancer tes clients d'il y a 1 à 2 mois : ils arrivent souvent au bout de leur parfum. Je peux t'aider si tu veux 😊`,
      });
    }
  }

  // Sélection : une place réservée au filleul, le reste par priorité ; le produit du jour complète.
  const helper = out.filter((a) => a.type === "filleul").slice(0, 1);
  const picked = out.filter((a) => a.type !== "filleul").slice(0, MAX_ACTIONS - helper.length);
  const plan = [...picked, ...helper];
  if (plan.length < MAX_ACTIONS && input.product) {
    plan.push({
      type: "statut",
      key: `statut:${now.toISOString().slice(0, 10)}`,
      title: `📣 Publier ${input.product.name} en statut`,
      detail: "Visuel prêt dans Mon marketing (avec votre QR code).",
      phone: null,
      message: `✨ ${input.product.name} est disponible chez moi ! Extrait de parfum concentré, livré chez vous. Commandez ici 👇 ${origin}/produits/${input.product.slug}${ref}`,
    });
  }
  return plan;
}

/** Lien WhatsApp vers le destinataire, message prérempli (ou partage libre pour un statut). */
export const actionLink = (a: Pick<CopilotAction, "phone" | "message">) => `https://wa.me/${a.phone ?? ""}?text=${encodeURIComponent(a.message)}`;

/** Message WhatsApp du matin envoyé au consultant (pur, testé). */
export function copilotWhatsAppText(name: string, actions: CopilotAction[]): string {
  return [
    `☀️ Bonjour ${first(name)} ! Vos ${actions.length} action${actions.length > 1 ? "s" : ""} du jour :`,
    ...actions.map((a, i) => `${i + 1}. ${a.title}`),
    "",
    "Tout est déjà rédigé : touchez le bouton, puis « Envoyer » pour chaque action. 💪",
  ].join("\n");
}
