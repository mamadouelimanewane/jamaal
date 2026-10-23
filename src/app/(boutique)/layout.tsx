import type { Metadata, Viewport } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "../globals.css";
import { siteBaseUrl } from "@/lib/site-url";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["500", "600", "700"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl()),
  title: { default: "Boutique JAMAAL", template: "%s · JAMAAL" },
  openGraph: { type: "website", locale: "fr_SN", siteName: "JAMAAL Luxury Cosmetics" },
};
export const viewport: Viewport = { themeColor: "#f6e9e3" };

/**
 * Boutique personnelle d'un consultant (/c/<slug>) : page de bio Instagram / TikTok, plein écran sur mobile,
 * sans l'en-tête ni le pied de page du site (comme un « Linktree »).
 */
export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#fdfbfa] text-foreground">{children}</body>
    </html>
  );
}
