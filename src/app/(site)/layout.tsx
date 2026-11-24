import { getBasePath, getLocale, getT } from "@/lib/i18n/server";
import { localizeHref, dirOf } from "@/lib/i18n/config";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getRateFor } from "@/lib/fx";
import { siteWhatsAppFor } from "@/lib/site-whatsapp";
import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ShopAssistant } from "@/components/ShopAssistant";
import { geminiConfigured } from "@/lib/ai/gemini";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { getCategoriesWithProducts } from "@/lib/db-categories";
import { siteBaseUrl } from "@/lib/site-url";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { MetaPixel } from "@/components/MetaPixel";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";
// La conseillère virtuelle peut enchaîner plusieurs appels à l'IA : 60 s laissées à la réponse.
export const maxDuration = 60;

const SITE_DESCRIPTION =
  "JAMAAL Luxury Cosmetics — parfums, soins et cosmétiques inspirés des plus grandes maisons de parfumerie, à prix juste.";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, path] = await Promise.all([getT(), getLocale(), getBasePath()]);
  const description = t(SITE_DESCRIPTION);
  return {
    metadataBase: new URL(siteBaseUrl()),
    title: {
      default: t("JAMAAL Luxury Cosmetics | Parfums inspirés des grandes maisons"),
      template: "%s | JAMAAL",
    },
    description,
    // Même page en français, en italien et en arabe (référencement).
    alternates: {
      canonical: localizeHref(path, locale),
      languages: { fr: path, it: localizeHref(path, "it"), ar: localizeHref(path, "ar"), en: localizeHref(path, "en"), "x-default": path },
    },
    openGraph: {
      type: "website",
      locale: OG[locale],
      alternateLocale: (Object.keys(OG) as (keyof typeof OG)[]).filter((l) => l !== locale).map((l) => OG[l]),
      siteName: "JAMAAL Luxury Cosmetics",
      title: "JAMAAL Luxury Cosmetics",
      description,
      images: [{ url: "/logo/jamaal-logo.jpg", alt: "JAMAAL Luxury Cosmetics" }],
    },
    twitter: { card: "summary_large_image" },
  };
}

const OG = { fr: "fr_SN", it: "it_IT", ar: "ar_SN", en: "en_GM" } as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, locale] = await Promise.all([getCategoriesWithProducts(), getLocale()]);
  const [rate, whatsapp] = await Promise.all([getRateFor(locale), siteWhatsAppFor(locale)]);
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${playfair.variable} ${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <LocaleProvider locale={locale} rate={rate} whatsapp={whatsapp}>
        <AnnouncementBar />
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <AnalyticsTracker />
        <MetaPixel />
        <Footer categories={categories} />
        <CartDrawer />
        <WhatsAppButton />
        {geminiConfigured() && <ShopAssistant />}
        </LocaleProvider>
      </body>
    </html>
  );
}
