import Link from "next/link";
import type { Category } from "@/data/types";
import { NewsletterForm } from "./NewsletterForm";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-0 bg-[#141f42] text-white/75">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="font-serif-display text-lg font-semibold text-white">JAMAAL</h3>
            <p className="mt-3 text-sm leading-relaxed">
              Parfums et cosmétiques inspirés des grandes maisons, à prix juste. Une collection
              signée JAMAAL Luxury Cosmetics.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99a]">
              Nos collections
            </h4>
            <ul className="flex flex-col gap-2 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`} className="hover:text-white">
                    {c.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99a]">
              JAMAAL
            </h4>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/devenir-consultant" className="hover:text-white">
                  Devenir consultant·e JAMAAL
                </Link>
              </li>
              <li>
                <Link href="/consultants" className="hover:text-white">
                  Liste des consultant·es
                </Link>
              </li>
              <li>
                <Link href="/avis-clients" className="hover:text-white">
                  Avis clients
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white">
                  Blog JAMAAL
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#d9a99a]">
              Newsletter
            </h4>
            <p className="mb-3 text-sm">
              Une lettre ponctuelle autour du parfum, des nouveautés et des gestes qui font la différence.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} JAMAAL Luxury Cosmetics. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-white">
              Mentions légales
            </Link>
            <Link href="/cgv" className="hover:text-white">
              CGV
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
