/**
 * Quiz de formation des revendeurs (pur) : connaissances produits, vente et règles du programme.
 * Le meilleur score de chaque revendeur est gardé (Formation).
 */
export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
}
export interface Quiz {
  id: string;
  title: string;
  intro: string;
  questions: QuizQuestion[];
}

export const QUIZZES: Quiz[] = [
  {
    id: "parfums-base",
    title: "Les parfums JAMAAL",
    intro: "Ce qu'il faut savoir pour conseiller un client en confiance.",
    questions: [
      {
        question: "Un parfum Olfazeta « inspiré de Sauvage », c'est…",
        choices: ["Le parfum Dior reconditionné", "Une création Chogan dont le sillage rappelle Sauvage", "Une copie interdite"],
        answer: 1,
        explanation: "On dit toujours « inspiré de » : c'est une création Olfazeta by Chogan, jamais « le même parfum » ni une copie.",
      },
      {
        question: "Quelle est la concentration des extraits de parfum JAMAAL ?",
        choices: ["8 %", "15 %", "30 %"],
        answer: 2,
        explanation: "Les extraits sont concentrés à 30 % d'essence : c'est l'argument de tenue à mettre en avant.",
      },
      {
        question: "Une cliente cherche « quelque chose de frais pour l'été ». Votre premier réflexe ?",
        choices: ["Proposer le plus cher", "Demander un parfum qu'elle aime déjà, puis proposer 2 ou 3 sillages frais", "Proposer un parfum oriental"],
        answer: 1,
        explanation: "Partir d'un parfum connu du client, puis proposer 2 ou 3 choix ciblés, c'est la méthode qui convertit le mieux.",
      },
      {
        question: "Un format est à zéro en stock. Que dites-vous ?",
        choices: ["« C'est en rupture, désolé »", "« Il est en cours de commande : vous pouvez le réserver avec un acompte »", "« Revenez dans un mois »"],
        answer: 1,
        explanation: "Un format à zéro se réserve depuis la fiche produit, avec un acompte : on ne perd pas la vente.",
      },
    ],
  },
  {
    id: "vente-whatsapp",
    title: "Vendre sur WhatsApp",
    intro: "Statuts, relances et objections.",
    questions: [
      {
        question: "Quel lien mettre dans vos statuts WhatsApp ?",
        choices: ["Le lien de l'accueil du site", "Votre lien personnel (boutique ou produit avec votre code)", "Aucun lien"],
        answer: 1,
        explanation: "Votre lien personnel attribue la vente à votre compte : sans lui, la commission peut vous échapper.",
      },
      {
        question: "« C'est cher » : quelle réponse est la plus juste ?",
        choices: ["Baisser le prix soi-même", "Comparer la tenue d'un extrait à 30 % au prix d'un parfum de marque, et proposer un format plus petit", "Ne pas répondre"],
        answer: 1,
        explanation: "Valeur (tenue, concentration) + alternative (format plus petit, coffret) : jamais de remise improvisée.",
      },
      {
        question: "Quand relancer un client qui a acheté un parfum ?",
        choices: ["Le lendemain", "Environ 45 jours après, quand le flacon se termine", "Jamais"],
        answer: 1,
        explanation: "Vers 45 jours le flacon se termine : c'est le bon moment (l'application vous le rappelle).",
      },
      {
        question: "Un client écrit STOP. Que faire ?",
        choices: ["Lui écrire quand même", "Respecter son choix : plus de messages automatiques", "Le relancer par SMS"],
        answer: 1,
        explanation: "Le respect du STOP protège la réputation de JAMAAL et votre numéro.",
      },
    ],
  },
  {
    id: "programme",
    title: "Le programme revendeur",
    intro: "Commissions, primes, wallet et équipe.",
    questions: [
      {
        question: "Quand une commission devient-elle due ?",
        choices: ["Dès que le client commande", "Quand la commande est encaissée (payée ou livrée) et non annulée", "En fin d'année"],
        answer: 1,
        explanation: "Seules les ventes encaissées et non annulées ouvrent droit à commission.",
      },
      {
        question: "Où voir ce qu'il vous manque pour la prime du mois ?",
        choices: ["Mes gains et l'assistant IA (« où j'en suis ? »)", "Nulle part", "Sur le site Chogan"],
        answer: 0,
        explanation: "La page Mes gains et le coach IA calculent le reste à vendre pour le palier suivant.",
      },
      {
        question: "Vous parrainez un nouveau revendeur. Que gagnez-vous ?",
        choices: ["Rien", "Une part de ses ventes (commission de parrain) et éventuellement un bonus démarrage rapide", "Ses clients"],
        answer: 1,
        explanation: "Le parrain touche une part des ventes de son équipe, plus les bonus prévus par le programme.",
      },
    ],
  },
];

export function scoreQuiz(quiz: Quiz, answers: number[]) {
  const corrections = quiz.questions.map((q, i) => ({ question: q.question, good: q.choices[q.answer], explanation: q.explanation, ok: answers[i] === q.answer }));
  return { score: corrections.filter((c) => c.ok).length, total: quiz.questions.length, corrections };
}
