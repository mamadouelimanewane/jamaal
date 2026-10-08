import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espaces privés et pages propres à une commande ou un client.
      disallow: ["/admin", "/api", "/panier", "/compte", "/commande", "/suivi", "/livreur", "/wishlist", "/recherche"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
