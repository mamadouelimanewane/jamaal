import type { Metadata, Viewport } from "next";
import {
  Playfair_Display, Poppins, Cormorant_Garamond, Jost, Bodoni_Moda, Manrope, Fraunces, DM_Sans, Instrument_Serif, Inter_Tight,
  Montserrat, DM_Serif_Display, Outfit, Libre_Caslon_Display, Nunito_Sans, Gilda_Display, Karla, Marcellus, Lato, Prata, Work_Sans,
  Cinzel, Raleway, Tenor_Sans, Inter, Yeseva_One, Quicksand, Italiana, Josefin_Sans,
} from "next/font/google";
import "../globals.css";
import { siteBaseUrl } from "@/lib/site-url";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["500", "600", "700"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

/*
 * Polices des thèmes de boutique (src/lib/shop/themes.ts). Hébergées par next/font (la CSP n'autorise
 * que les polices du site) et non préchargées : le navigateur ne télécharge que celles du thème affiché.
 */
const f_cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-cormorant", weight: ["500", "600"], style: ["normal", "italic"] });
const f_jost = Jost({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-jost" });
const f_bodoni = Bodoni_Moda({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-bodoni", style: ["normal", "italic"] });
const f_manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-manrope" });
const f_fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-fraunces", style: ["normal", "italic"] });
const f_dmsans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmsans" });
const f_instrument = Instrument_Serif({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-instrument", weight: "400", style: ["normal", "italic"] });
const f_intertight = Inter_Tight({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-intertight" });
const f_montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-montserrat" });
const f_dmserif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmserif", weight: "400", style: ["normal", "italic"] });
const f_outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-outfit" });
const f_caslon = Libre_Caslon_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-caslon", weight: "400" });
const f_nunito = Nunito_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-nunito" });
const f_gilda = Gilda_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-gilda", weight: "400" });
const f_karla = Karla({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-karla" });
const f_marcellus = Marcellus({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-marcellus", weight: "400" });
const f_lato = Lato({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lato", weight: ["300", "400", "700"] });
const f_prata = Prata({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-prata", weight: "400" });
const f_worksans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-worksans" });
const f_cinzel = Cinzel({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-cinzel" });
const f_raleway = Raleway({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-raleway" });
const f_tenor = Tenor_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-tenor", weight: "400" });
const f_inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-inter" });
const f_yeseva = Yeseva_One({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-yeseva", weight: "400" });
const f_quicksand = Quicksand({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-quicksand" });
const f_italiana = Italiana({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-italiana", weight: "400" });
const f_josefin = Josefin_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-josefin" });
const fontVars = [f_cormorant, f_jost, f_bodoni, f_manrope, f_fraunces, f_dmsans, f_instrument, f_intertight, f_montserrat, f_dmserif, f_outfit, f_caslon, f_nunito, f_gilda, f_karla, f_marcellus, f_lato, f_prata, f_worksans, f_cinzel, f_raleway, f_tenor, f_inter, f_yeseva, f_quicksand, f_italiana, f_josefin].map((f) => f.variable).join(" ");

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
    <html lang="fr" className={`${playfair.variable} ${poppins.variable} ${fontVars} h-full antialiased`}>
      <body className="min-h-full bg-[#fdfbfa] text-foreground">{children}</body>
    </html>
  );
}
