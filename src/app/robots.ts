import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site-url";
import { HONEYPOT_PATH } from "@/lib/bot-guard";

/** Robots d'IA et outils de copie : interdits sur tout le site (le proxy les refuse de toute façon). */
const NO_COPY_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Bytespider", "PerplexityBot",
  "Amazonbot", "Diffbot", "Omgilibot", "ImagesiftBot", "cohere-ai", "Meta-ExternalAgent", "Google-Extended", "Applebot-Extended",
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "PetalBot", "DataForSeoBot", "ia_archiver", "archive.org_bot", "HTTrack", "Wget",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Espaces privés, pages propres à une commande ou un client, et le lien piège (réservé aux aspirateurs).
        disallow: ["/admin", "/api", "/panier", "/compte", "/commande", "/suivi", "/livreur", "/wishlist", "/recherche", HONEYPOT_PATH],
      },
      { userAgent: NO_COPY_BOTS, disallow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
