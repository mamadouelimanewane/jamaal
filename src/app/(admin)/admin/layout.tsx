import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/admin/PwaRegister";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Back-office JAMAAL",
  robots: { index: false, follow: false },
  // Application installable (écran d'accueil) pour les consultants et livreurs
  manifest: "/revendeur.webmanifest",
  icons: { apple: "/icons/v2/jamaal-apple-180.png" },
  appleWebApp: { capable: true, title: "JAMAAL", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1d2f4f" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-cream font-sans text-foreground">
        {/* L'invite d'installation peut arriver avant le chargement de la page : on la garde pour le bouton « Installer ». */}
        <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__jamaalInstall=e;window.dispatchEvent(new Event('jamaal-install-ready'));});" }} />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
