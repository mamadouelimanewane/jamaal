import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/admin/PwaRegister";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Back-office JAMAAL",
  robots: { index: false, follow: false },
  // Application installable (écran d'accueil) pour les consultants et livreurs
  manifest: "/revendeur.webmanifest",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "JAMAAL", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1d2f4f" };

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-cream font-sans text-foreground">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
