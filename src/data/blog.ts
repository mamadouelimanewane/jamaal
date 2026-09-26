export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "comment-choisir-son-parfum-signature",
    title: "Comment choisir son parfum signature ?",
    date: "2026-09-10",
    excerpt:
      "Notes de tête, de cœur, de fond : nos conseils pour trouver la fragrance qui vous ressemble.",
    content: [
      "Choisir un parfum signature demande un peu de patience : une fragrance évolue sur la peau en trois temps, les notes de tête, de cœur et de fond.",
      "Commencez par identifier les familles olfactives qui vous attirent naturellement (floral, boisé, oriental, frais) avant de tester plusieurs références de la même famille.",
      "Chez JAMAAL, chaque parfum est classé par famille olfactive pour vous aider à affiner votre choix en quelques clics.",
    ],
  },
  {
    slug: "bien-appliquer-son-parfum",
    title: "Bien appliquer son parfum pour une tenue optimale",
    date: "2026-08-22",
    excerpt: "Les bons gestes pour faire durer votre fragrance JAMAAL toute la journée.",
    content: [
      "Vaporisez votre parfum sur les points de pulsation : poignets, cou, derrière les oreilles.",
      "Évitez de frotter les poignets l'un contre l'autre, ce geste altère les molécules olfactives.",
      "Conservez votre flacon à l'abri de la lumière et de la chaleur pour préserver sa qualité.",
    ],
  },
  {
    slug: "devenir-consultant-jamaal-le-guide",
    title: "Devenir consultant·e JAMAAL : le guide complet",
    date: "2026-07-30",
    excerpt: "Tout ce qu'il faut savoir avant de rejoindre le réseau de consultant·es JAMAAL.",
    content: [
      "Le réseau de consultant·es JAMAAL permet à chacun·e de proposer la collection JAMAAL à son propre réseau, avec sa propre vitrine en ligne.",
      "Après inscription, vous recevez un accès à votre espace consultant·e ainsi que les visuels et supports marketing officiels de la marque.",
      "Contactez-nous via la page dédiée pour recevoir votre lien d'inscription personnel.",
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
