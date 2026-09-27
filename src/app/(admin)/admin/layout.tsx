import type { Metadata } from "next";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Back-office JAMAAL",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-cream font-sans text-foreground">{children}</body>
    </html>
  );
}
