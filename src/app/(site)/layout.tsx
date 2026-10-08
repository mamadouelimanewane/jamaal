import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "../globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { getCategoriesWithProducts } from "@/lib/db-categories";
import { siteBaseUrl } from "@/lib/site-url";

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

const SITE_DESCRIPTION =
  "JAMAAL Luxury Cosmetics — parfums, soins et cosmétiques inspirés des plus grandes maisons de parfumerie, à prix juste.";

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl()),
  title: {
    default: "JAMAAL Luxury Cosmetics | Parfums inspirés des grandes maisons",
    template: "%s | JAMAAL",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "fr_SN",
    siteName: "JAMAAL Luxury Cosmetics",
    title: "JAMAAL Luxury Cosmetics",
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo/jamaal-logo.jpg", alt: "JAMAAL Luxury Cosmetics" }],
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categories = await getCategoriesWithProducts();
  return (
    <html lang="fr" className={`${playfair.variable} ${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AnnouncementBar />
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
        <CartDrawer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
