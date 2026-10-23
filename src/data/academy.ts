/**
 * Académie JAMAAL (pur, testé) : modules courts (vidéo facultative, leçon, quiz) qui mènent à des badges
 * affichés sur la boutique personnelle du consultant. Un module est validé à 80 % de bonnes réponses ; un badge
 * est obtenu quand tous ses modules sont validés. Les vidéos se règlent dans Admin › Académie.
 */
import { QUIZZES, type QuizQuestion } from "./quiz-formation";

export const PASS_RATIO = 0.8;

export type AcademyModule = {
  id: string;
  title: string;
  minutes: number;
  /** Points clés de la leçon (affichés sous la vidéo, ou seuls s'il n'y a pas de vidéo) */
  lesson: string[];
  questions: QuizQuestion[];
};

export type BadgeId = "experte-parfums" | "conseillere-soins" | "pro-whatsapp";
export type Badge = {
  id: BadgeId;
  /** Libellés au féminin et au masculin (choix du consultant dans « Ma boutique ») */
  label: { f: string; m: string };
  emoji: string;
  /** Ce que le badge garantit au client (affiché sur la boutique) */
  promise: string;
  color: string;
  modules: AcademyModule[];
};

const fromQuiz = (id: string) => QUIZZES.find((q) => q.id === id)?.questions ?? [];

export const BADGES: Badge[] = [
  {
    id: "experte-parfums",
    label: { f: "Experte parfums", m: "Expert parfums" },
    emoji: "🌸",
    promise: "Formé·e par l'Académie JAMAAL aux familles olfactives et au conseil parfum : on trouve ensemble le sillage qui vous ressemble.",
    color: "#b4536d",
    modules: [
      {
        id: "parfum-familles",
        title: "Les familles olfactives",
        minutes: 4,
        lesson: [
          "Cinq grandes familles suffisent pour conseiller : fraîche (agrumes, marin), florale (rose, jasmin), boisée (cèdre, santal, vétiver), orientale (ambre, épices, oud) et gourmande (vanille, caramel, tonka).",
          "Une famille décrit le caractère du parfum : frais et léger, élégant, chaleureux, intense ou sucré.",
          "Au Sénégal, les familles orientales et boisées (oud, ambre, encens) sont très demandées pour les cérémonies et le soir.",
          "Les parfums frais conviennent à la chaleur de la journée, au bureau et au sport.",
          "Un même client peut aimer deux familles : un parfum frais pour le jour, un oriental pour le soir.",
        ],
        questions: [
          { question: "Vanille, caramel et fève tonka appartiennent à la famille…", choices: ["Fraîche", "Gourmande", "Boisée"], answer: 1, explanation: "Les notes sucrées et douces forment la famille gourmande." },
          { question: "Un client veut un parfum pour un mariage, le soir, qui se remarque. Vous orientez vers…", choices: ["Un oriental ou un boisé ambré", "Un parfum marin léger", "Une eau de Cologne citronnée"], answer: 0, explanation: "Ambre, oud et épices donnent un sillage intense, idéal le soir et pour les cérémonies." },
          { question: "Bergamote, citron et notes marines évoquent la famille…", choices: ["Orientale", "Fraîche", "Gourmande"], answer: 1, explanation: "Agrumes et notes marines : c'est la famille fraîche, parfaite en journée." },
          { question: "Combien de grandes familles faut-il connaître pour bien conseiller ?", choices: ["2", "5", "12"], answer: 1, explanation: "Fraîche, florale, boisée, orientale, gourmande : cinq familles suffisent." },
          { question: "Le cèdre, le santal et le vétiver sont des notes…", choices: ["Boisées", "Florales", "Gourmandes"], answer: 0, explanation: "Ce sont les grandes notes boisées." },
        ],
      },
      {
        id: "parfum-notes",
        title: "Notes de tête, de cœur et de fond",
        minutes: 3,
        lesson: [
          "Un parfum évolue : les notes de tête se sentent les premières minutes, les notes de cœur pendant quelques heures, les notes de fond tiennent toute la journée.",
          "Faites sentir le parfum sur la peau et attendez 10 minutes avant de juger : c'est le cœur qui compte.",
          "Les extraits JAMAAL sont concentrés à 30 % : ils tiennent plus longtemps qu'une eau de toilette.",
          "Conseil d'application : poignets, cou et derrière les oreilles, sans frotter. Sur les vêtements, le parfum dure encore plus.",
          "Le parfum tient plus longtemps sur une peau hydratée : proposez la crème ou le gel douche assorti.",
        ],
        questions: [
          { question: "Les notes que l'on sent en premier, juste après l'application, sont…", choices: ["Les notes de fond", "Les notes de tête", "Les notes de cœur"], answer: 1, explanation: "Les notes de tête sont les plus volatiles : elles s'évaporent les premières." },
          { question: "Pour bien juger un parfum, il faut…", choices: ["Le sentir au flacon", "Attendre une dizaine de minutes sur la peau", "Le sentir sur du papier tout de suite"], answer: 1, explanation: "Le cœur du parfum se révèle après quelques minutes sur la peau." },
          { question: "Frotter ses poignets après avoir mis du parfum…", choices: ["Le fait mieux tenir", "Abîme les notes et réduit la tenue", "N'a aucun effet"], answer: 1, explanation: "Frotter échauffe la peau et casse les notes de tête : on applique sans frotter." },
          { question: "Quel produit aide le parfum à tenir plus longtemps ?", choices: ["Une crème hydratante assortie", "De l'alcool", "Un savon parfumé différent"], answer: 0, explanation: "Une peau hydratée retient mieux le parfum : c'est aussi une vente complémentaire." },
        ],
      },
      { id: "parfums-base", title: "Conseiller un parfum en confiance", minutes: 4, lesson: [
        "On dit toujours « inspiré de » : c'est une création Olfazeta by Chogan, jamais « le même » ni une copie.",
        "Partez d'un parfum que le client aime déjà, puis proposez 2 ou 3 choix ciblés (le Parfum ADN le fait pour vous).",
        "Mettez en avant la tenue (extrait à 30 %), le prix juste et la livraison à domicile.",
        "Proposez le petit format ou le coffret découverte quand le client hésite.",
      ], questions: fromQuiz("parfums-base") },
    ],
  },
  {
    id: "conseillere-soins",
    label: { f: "Conseillère soins", m: "Conseiller soins" },
    emoji: "✨",
    promise: "Formé·e par l'Académie JAMAAL aux soins des peaux noires et métissées : une routine adaptée à votre peau, sans éclaircir.",
    color: "#2f6b5a",
    modules: [
      {
        id: "soins-types-peau",
        title: "Reconnaître son type de peau",
        minutes: 3,
        lesson: [
          "Quatre types principaux : sèche (tiraillements), grasse (brillance), mixte (zone T brillante, joues normales) et normale.",
          "Une question simple : « En fin de journée, votre peau est plutôt brillante, sèche ou les deux ? »",
          "La peau sensible rougit ou picote : on évite les produits trop parfumés et on teste d'abord.",
          "Le Skin Advisor JAMAAL aide à identifier le type de peau en un selfie et quelques questions.",
        ],
        questions: [
          { question: "Une peau brillante sur le front, le nez et le menton, mais normale sur les joues, est…", choices: ["Sèche", "Mixte", "Normale"], answer: 1, explanation: "Zone T brillante et joues normales : c'est une peau mixte." },
          { question: "La meilleure question pour connaître le type de peau d'une cliente ?", choices: ["« Quel âge avez-vous ? »", "« En fin de journée, votre peau est plutôt brillante ou sèche ? »", "« Quelle crème utilisez-vous ? »"], answer: 1, explanation: "L'état de la peau en fin de journée révèle son type." },
          { question: "Une peau qui tiraille après la douche est plutôt…", choices: ["Sèche", "Grasse", "Mixte"], answer: 0, explanation: "Le tiraillement est le signe d'une peau sèche qui manque d'hydratation." },
          { question: "Quel outil JAMAAL aide à identifier le type de peau ?", choices: ["Le Parfum ADN", "Le Skin Advisor", "La carte cadeau"], answer: 1, explanation: "Le Skin Advisor analyse la peau à partir d'un selfie et de quelques questions." },
        ],
      },
      {
        id: "soins-peaux-noires",
        title: "Peaux noires et métissées : taches et éclat",
        minutes: 4,
        lesson: [
          "Les peaux foncées marquent facilement : un bouton ou une irritation peut laisser une tache (hyperpigmentation).",
          "On unifie le teint et on apporte de l'éclat (vitamine C, exfoliation douce) ; on ne cherche jamais à éclaircir la peau.",
          "Ne jamais conseiller de produits éclaircissants ou dépigmentants : ils sont dangereux pour la santé.",
          "La protection solaire est indispensable, même sur une peau noire : le soleil fonce les taches.",
          "Des résultats visibles demandent 4 à 8 semaines d'utilisation régulière : dites-le pour éviter la déception.",
        ],
        questions: [
          { question: "Une cliente veut « éclaircir sa peau ». Vous répondez…", choices: ["Je vous propose un produit éclaircissant", "Nous unifions le teint et ravivons l'éclat, sans jamais éclaircir : c'est plus sûr et plus beau", "Ce n'est pas possible"], answer: 1, explanation: "On ne conseille jamais d'éclaircissant : on travaille l'éclat et les taches." },
          { question: "Pourquoi la protection solaire est-elle utile sur une peau noire ?", choices: ["Elle ne l'est pas", "Le soleil fonce les taches et abîme la peau", "Pour éclaircir la peau"], answer: 1, explanation: "Le soleil accentue l'hyperpigmentation : la protection est indispensable." },
          { question: "En combien de temps voit-on des résultats sur les taches ?", choices: ["2 jours", "4 à 8 semaines", "1 an"], answer: 1, explanation: "Il faut 4 à 8 semaines d'utilisation régulière : annoncez-le dès la vente." },
          { question: "La vitamine C est utile pour…", choices: ["L'éclat et les taches", "Hydrater uniquement les cheveux", "Parfumer la peau"], answer: 0, explanation: "La vitamine C ravive l'éclat et aide à estomper les taches." },
        ],
      },
      {
        id: "soins-routine",
        title: "Construire une routine simple",
        minutes: 3,
        lesson: [
          "Le matin : nettoyer, traiter (sérum), hydrater, protéger. Le soir : nettoyer, traiter, réparer (crème de nuit).",
          "Mieux vaut 3 produits utilisés tous les jours que 8 produits oubliés : commencez simple.",
          "Le masque ou le gommage, une à deux fois par semaine seulement.",
          "Une routine complète se vend mieux en coffret, et le client revient pour le réassort tous les 45 à 60 jours.",
        ],
        questions: [
          { question: "Dans quel ordre appliquer les soins le matin ?", choices: ["Crème, sérum, nettoyant", "Nettoyant, sérum, crème, protection", "Protection solaire seule"], answer: 1, explanation: "Nettoyer, traiter, hydrater, protéger : du plus léger au plus riche." },
          { question: "Le gommage s'utilise…", choices: ["Tous les jours, matin et soir", "Une à deux fois par semaine", "Jamais"], answer: 1, explanation: "Une à deux fois par semaine suffit : plus souvent, il irrite la peau." },
          { question: "Pour une cliente qui débute, vous proposez…", choices: ["Une routine de 3 produits essentiels", "Tous les produits de la gamme", "Uniquement un parfum"], answer: 0, explanation: "Une routine simple est mieux suivie, donc donne plus de résultats." },
          { question: "Quand relancer une cliente pour son réassort ?", choices: ["Le lendemain", "Après 45 à 60 jours", "Jamais"], answer: 1, explanation: "Un soin dure environ 45 à 60 jours : c'est le bon moment (le réassort automatique le fait aussi)." },
        ],
      },
    ],
  },
  {
    id: "pro-whatsapp",
    label: { f: "Pro de la vente WhatsApp", m: "Pro de la vente WhatsApp" },
    emoji: "💬",
    promise: "Formé·e par l'Académie JAMAAL au conseil et au suivi sur WhatsApp : réponse rapide et commande jusqu'à la livraison.",
    color: "#1f8a4c",
    modules: [
      { id: "vente-whatsapp", title: "Vendre sur WhatsApp", minutes: 4, lesson: [
        "3 à 4 statuts par jour au plus, avec une belle photo et un texte court.",
        "Répondez vite, avec un prix et un lien de commande : le client décide dans l'heure.",
        "Utilisez vos liens personnels : chaque vente vous est attribuée automatiquement.",
      ], questions: fromQuiz("vente-whatsapp") },
      {
        id: "vente-relance",
        title: "Relancer sans déranger",
        minutes: 3,
        lesson: [
          "Relancez au bon moment : 35 à 60 jours après un achat, au moment où le flacon se termine.",
          "Un message personnel (prénom, produit acheté) vaut mieux qu'un message général.",
          "Une seule relance suffit ; si le client ne répond pas, on n'insiste pas.",
          "Le client qui répond STOP ne doit plus recevoir de message : respectez-le toujours.",
          "Vos « actions du jour » préparent chaque matin les relances avec le message déjà rédigé.",
        ],
        questions: [
          { question: "Quel est le meilleur moment pour relancer un client ?", choices: ["Le lendemain de l'achat", "35 à 60 jours après, quand le flacon se termine", "Tous les jours"], answer: 1, explanation: "Un parfum ou un soin dure environ 1 à 2 mois : c'est le moment idéal." },
          { question: "Un client a répondu STOP. Vous…", choices: ["Le relancez une semaine plus tard", "Ne lui envoyez plus de message", "Lui écrivez depuis un autre numéro"], answer: 1, explanation: "STOP est définitif : on respecte toujours le choix du client." },
          { question: "Le message de relance le plus efficace est…", choices: ["« Promo ! »", "Personnel : prénom et produit acheté", "Une longue liste de produits"], answer: 1, explanation: "Un message personnel montre que vous vous souvenez du client." },
          { question: "Le client ne répond pas à votre relance. Vous…", choices: ["Relancez chaque jour", "N'insistez pas", "L'appelez plusieurs fois"], answer: 1, explanation: "Une relance suffit : insister fait perdre le client." },
        ],
      },
    ],
  },
];

export const ALL_MODULES = BADGES.flatMap((b) => b.modules);
export const moduleById = (id: string) => ALL_MODULES.find((m) => m.id === id) ?? null;
export const badgeLabel = (b: Badge, form: string | null | undefined) => (form === "m" ? b.label.m : b.label.f);

export type ModuleResult = { quizId: string; score: number; total: number; updatedAt?: Date };
export const passed = (r: { score: number; total: number } | undefined | null) => !!r && r.total > 0 && r.score / r.total >= PASS_RATIO;

/** Progression : modules validés par badge et badges obtenus (avec la date de validation du dernier module). */
export function academyProgress(results: ModuleResult[]) {
  const byId = new Map(results.map((r) => [r.quizId, r]));
  return BADGES.map((b) => {
    const done = b.modules.filter((m) => passed(byId.get(m.id)));
    const earned = done.length === b.modules.length;
    const dates = done.map((m) => byId.get(m.id)?.updatedAt).filter((d): d is Date => !!d);
    return { badge: b, done: done.length, total: b.modules.length, earned, earnedAt: earned && dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null };
  });
}

/** Lien de vidéo → adresse à intégrer (YouTube, Vimeo) ou fichier vidéo direct. Pur, testé. */
export function videoEmbed(url: string | null | undefined): { kind: "iframe" | "video"; src: string } | null {
  const u = (url ?? "").trim();
  if (!/^https:\/\//.test(u)) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: "video", src: u };
  return null;
}
