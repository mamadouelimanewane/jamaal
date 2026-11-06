import { getT } from "@/lib/i18n/server";
import Link from "@/components/i18n/Link";
import { BrandLogo } from "@/components/BrandLogo";
import type { Category } from "@/data/types";
import { NewsletterForm } from "./NewsletterForm";

export async function Footer({ categories }: { categories: Category[] }) {
  const t = await getT();
  return (
    <footer className="mt-0 bg-[#14213b] text-white/75">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" aria-label={t("JAMAAL — accueil")} className="inline-block rounded-2xl bg-white p-2.5">
              <BrandLogo height={104} />
            </Link>
            <p className="mt-3 text-sm leading-relaxed">
              {t("Parfums et cosmétiques inspirés des grandes maisons, à prix juste. Une collection signée JAMAAL Luxury Cosmetics.")}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99d]">
              {t("Nos collections")}
            </h4>
            <ul className="flex flex-col gap-2 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`} className="hover:text-white">
                    {t(c.navLabel)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99d]">
              JAMAAL
            </h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/devenir-consultant" className="hover:text-white">
                  {t("Devenir consultant·e JAMAAL")}
                </Link>
              </li>
              <li>
                <Link href="/consultants" className="hover:text-white">
                  {t("Liste des consultant·es")}
                </Link>
              </li>
              <li>
                <Link href="/avis-clients" className="hover:text-white">
                  {t("Avis clients")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white">
                  {t("Blog JAMAAL")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  {t("Contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99d]">
              {t("Newsletter")}
            </h4>
            <p className="mb-3 text-sm">
              {t("Une lettre ponctuelle autour du parfum, des nouveautés et des gestes qui font la différence.")}
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {t("JAMAAL Luxury Cosmetics, revendeur officiel de la marque CHOGAN (Italie). Tous droits réservés.")}</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-white">
              {t("Mentions légales")}
            </Link>
            <Link href="/cgv" className="hover:text-white">
              CGV
            </Link>
          </div>
        </div>
      </div>
      {/* Lien piège du robot anti-aspiration : invisible, ignoré des lecteurs d'écran et interdit dans robots.txt.
          Seul un aspirateur le suit, et il est alors bloqué (src/lib/bot-guard.ts). */}
      <a href="/catalogue-integral" rel="nofollow" tabIndex={-1} aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        {t("Catalogue intégral")}
      </a>
    </footer>
  );
}
