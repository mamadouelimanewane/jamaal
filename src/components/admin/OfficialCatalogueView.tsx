"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Download, Sparkles, Phone, MapPin, Globe, Share2, Check } from "lucide-react";

interface OfficialCatalogueViewProps {
  consultantName: string | null;
  consultantPhone: string | null;
  consultantCity: string | null;
  consultantSlug: string | null;
}

export function OfficialCatalogueView({
  consultantName,
  consultantPhone,
  consultantCity,
  consultantSlug,
}: OfficialCatalogueViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const name = consultantName || "Votre Conseiller(ère) JAMAAL";
  const phone = consultantPhone || "77 XXX XX XX";
  const city = consultantCity || "Dakar";
  const siteUrl = consultantSlug ? `jamaal.sn/c/${consultantSlug}` : "jamaal.sn";

  return (
    <div className="space-y-6">
      {/* ── BARRE D'ACTIONS FLOTTANTE EN HAUT ───────────────────────────── */}
      <div className="print:hidden rounded-2xl border border-line bg-white p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              <Sparkles size={12} /> Brochure Officielle 12 Pages A4
            </span>
            <span className="text-xs text-navy/60 font-medium">Prix JAMAAL en FCFA · Modèles inclusifs</span>
          </div>
          <h2 className="font-serif-display text-lg font-bold text-navy mt-1">
            Catalogue Tarif Parfums & Cosmétiques JAMAAL
          </h2>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-navy-light shadow-md transition cursor-pointer"
          >
            <Printer size={15} />
            <span>Imprimer / Enregistrer en PDF (12 pages)</span>
          </button>
        </div>
      </div>

      {/* ── STYLE D'IMPRESSION A4 STRICT ────────────────────────────────── */}
      <style jsx global>{`
        .catalogue-page {
          position: relative !important;
          isolation: isolate !important;
        }
        .catalogue-page::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background-image: url('/images/bg-afro-woman.jpg') !important;
          background-size: cover !important;
          background-position: center top !important;
          opacity: 0.15 !important;
          filter: contrast(1.15) brightness(0.95) !important;
          pointer-events: none !important;
          z-index: 0 !important;
          border-radius: inherit !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .catalogue-page > * {
          position: relative !important;
          z-index: 1 !important;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          nav, header, footer, aside, .print\\:hidden {
            display: none !important;
          }
          .catalogue-page {
            page-break-after: always !important;
            break-after: page !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 auto !important;
            padding: 10mm 12mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .catalogue-page::before {
            opacity: 0.17 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── CONTENEUR DES 12 PAGES DU CATALOGUE ─────────────────────────── */}
      <div className="space-y-8 print:space-y-0 max-w-4xl mx-auto">

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 1 : COUVERTURE OFFICIELLE
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#211814] text-[#f7ede5] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col justify-between p-8 sm:p-14 min-h-[750px]">
          {/* En-tête avec Logo JAMAAL */}
          <div className="text-center pt-2">
            <div className="inline-block bg-white p-3 rounded-2xl shadow-xl mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/jamaal-logo.jpg" alt="JAMAAL Luxury Cosmetics" className="h-16 w-auto rounded-lg mx-auto" />
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-[#d4af37] font-semibold">
              Haute Parfumerie & Cosmétiques d&apos;Exception
            </p>
          </div>

          {/* Titre & Slogan en Français */}
          <div className="my-8 text-center">
            <h1 className="font-serif-display text-4xl sm:text-6xl font-bold tracking-wide text-white">
              Catalogue Parfums
            </h1>
            <p className="font-serif-display italic text-xl sm:text-2xl text-[#d4af37] mt-2">
              Collection Privée Chogan
            </p>

            <div className="w-16 h-0.5 bg-[#d4af37] mx-auto my-6" />

            <p className="font-serif-display text-sm sm:text-base tracking-widest uppercase text-[#ecdacf] max-w-md mx-auto leading-relaxed">
              « Un parfum ne se porte pas, il se vit.<br />
              Découvrez la fragrance qui parle de vous. »
            </p>
          </div>

          {/* Image centrale cuir & flacons luxe */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-[#d4af37]/40 shadow-2xl mx-auto w-full max-w-lg aspect-[16/9] bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=1200&auto=format&fit=crop"
              alt="Flacons de parfum de luxe"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            <div className="relative z-10 text-center p-4 bg-black/50 backdrop-blur-xs rounded-2xl border border-[#d4af37]/30">
              <p className="text-xs uppercase tracking-widest text-[#d4af37] font-bold">Extraits de Parfum</p>
              <p className="text-sm font-serif-display text-white mt-0.5">30 % d&apos;Essence Pure · Longue Tenue</p>
            </div>
          </div>

          {/* Pied de page couverture */}
          <div className="border-t border-[#d4af37]/25 pt-4 mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#ecdacf]/80 gap-2">
            <span>Édition Officielle JAMAAL · Sénégal</span>
            <span className="font-semibold text-[#d4af37]">Tarifs Officiels en FCFA</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 2 : TARIF HOMME
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Catalogue JAMAAL</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Tarif Homme
                </h2>
              </div>
            </div>
            {/* Portrait homme européen élégant */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-amber-400/60 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop"
                  alt="Homme élégant"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-right text-xs hidden sm:block">
                <span className="block font-bold text-amber-300">Extraits de Parfum</span>
                <span className="text-slate-400 text-[10px]">30% d&apos;essence</span>
              </span>
            </div>
          </div>

          {/* Tableau Homme */}
          <div className="mt-4 overflow-x-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-400/40 text-[10px] uppercase text-amber-300 tracking-wider">
                  <th className="py-1 px-1.5 font-bold">Code</th>
                  <th className="py-1 px-1.5">Nom du Parfum</th>
                  <th className="py-1 px-1.5 text-rose-300 font-serif-display italic">Inspiré de :</th>
                  <th className="py-1 px-1.5">Maison</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">15 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">30 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">70 ML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {[
                  { c: "001M", n: "PRESTIGE FOR HIM", i: "One Million", b: "Paco Rabanne", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "002M", n: "DEEP BLUE FOR HIM", i: "Acqua Di Gio'", b: "Armani", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "003M", n: "FIREBORN", i: "Fahrenheit", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "004M", n: "PURE EGO FOR HIM", i: "The One", b: "D&G", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "012M", n: "REVENANT", i: "Eau Sauvage", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "016M", n: "SAILOR", i: "Le Male", b: "Jean Paul Gaultier", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "018M", n: "REVELATION", i: "Déclaration", b: "Cartier", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "020M", n: "OBSCURO", i: "La Nuit de L'Homme", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "021M", n: "AQUA SOUL FOR HIM", i: "Light Blue", b: "D&G", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "022M", n: "ELEMENTAL", i: "Terre d'Hermès", b: "Hermès", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "030M", n: "MAVERICK", i: "Black XS", b: "Paco Rabanne", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "032M", n: "EXPLOSIVE", i: "Spicebomb", b: "Viktor & Rolf", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "033M", n: "NIGHTFALL", i: "Armani Code", b: "Armani", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "038M", n: "ABYSS", i: "Bleu de Chanel", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "048M", n: "SUBLIME FOR HIM", i: "Allure Homme", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "060",  n: "ARABIAN MIRAGE", i: "Millésime Impérial", b: "Creed", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "061M", n: "TRIUMPH", i: "Invictus", b: "Paco Rabanne", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "068M", n: "GLORY FOR HIM", i: "Aventus", b: "Creed", p15: "14 700", p30: "24 200", p70: "46 700" },
                  { c: "079M", n: "SO TRUE", i: "MYSLF", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "084M", n: "INDIGO", i: "Dylan Blue", b: "Versace", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "086M", n: "TITAN", i: "Legend", b: "Montblanc", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "087M", n: "WILDMAN", i: "Wanted", b: "Azzaro", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "094M", n: "REVENANT INTENSE", i: "Sauvage", b: "Dior", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "108",  n: "GREEN IRISH", i: "Green Irish Tweed", b: "Creed", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "113M", n: "YOUR JOURNEY", i: "Sur La Route", b: "Louis Vuitton", p15: "14 700", p30: "24 200", p70: "46 700" },
                  { c: "136M", n: "MODERN MAN", i: "Dior Homme Intense", b: "Dior", p15: "11 400", p30: "19 300", p70: "36 900" },
                  { c: "140M", n: "CUPID", i: "Eros", b: "Versace", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "147M", n: "DARK NECTAR", i: "Boss Bottled Absolu", b: "Hugo Boss", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "162M", n: "ETERNAL LOVE FOR HIM", i: "Born In Roma Uomo Intense", b: "Valentino", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "164M", n: "UNFOLD", i: "Paradoxe Intense", b: "Prada", p15: "11 400", p30: "19 300", p70: "36 900" },
                ].map((row) => (
                  <tr key={row.c} className="hover:bg-slate-800/40">
                    <td className="py-1 px-1.5 font-mono font-bold text-amber-300">{row.c}</td>
                    <td className="py-1 px-1.5 font-semibold text-white">{row.n}</td>
                    <td className="py-1 px-1.5 text-rose-300 font-serif-display italic">{row.i}</td>
                    <td className="py-1 px-1.5 text-slate-400">{row.b}</td>
                    <td className="py-1 px-1.5 text-right font-mono text-emerald-400">{row.p15} F</td>
                    <td className="py-1 px-1.5 text-right font-mono text-emerald-400">{row.p30} F</td>
                    <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-400">{row.p70} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-400 flex justify-between">
            <span>Prix exprimés en Francs CFA (FCFA) TTC · Produits distribués au Sénégal par JAMAAL</span>
            <span>Page 2 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 3 : TARIF FEMME (PARTIE 1) - AVEC FEMME AFRO-DESCENDANTE
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#18131d] text-[#f7eefb] rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-[#3b2746]">
          <div className="flex items-center justify-between border-b border-[#523363] pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-rose-300 font-bold">Catalogue JAMAAL</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Tarif Femme <span className="text-base text-rose-300 font-normal">(Partie 1)</span>
                </h2>
              </div>
            </div>
            {/* Portrait sublime femme afro-descendante */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-rose-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop"
                  alt="Femme afro-descendante élégante"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-right text-xs hidden sm:block">
                <span className="block font-bold text-rose-300">Sillage & Féminité</span>
                <span className="text-slate-400 text-[10px]">Concentration 30%</span>
              </span>
            </div>
          </div>

          {/* Tableau Femme 1 */}
          <div className="mt-4 overflow-x-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rose-400/40 text-[10px] uppercase text-rose-300 tracking-wider">
                  <th className="py-1 px-1.5 font-bold">Code</th>
                  <th className="py-1 px-1.5">Nom du Parfum</th>
                  <th className="py-1 px-1.5 text-amber-300 font-serif-display italic">Inspiré de :</th>
                  <th className="py-1 px-1.5">Maison</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">15 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">30 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">70 ML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#34203e]">
                {[
                  { c: "006M", n: "ADDICTION", i: "Opium", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "007W", n: "PURE GOLD", i: "J'adore", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "010W", n: "STRANGER", i: "Alien", b: "Thierry Mugler", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "011W", n: "AQUA SOUL FOR HER", i: "Light Blue", b: "D&G", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "014W", n: "STATEMENT", i: "Manifesto", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "019W", n: "PRESTIGE FOR HER", i: "Lady Million", b: "Paco Rabanne", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "023W", n: "FATALE", i: "Hypnotic Poison", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "024W", n: "THE ESSENCE", i: "N°5", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "025W", n: "HER SECRET", i: "For Her", b: "Narciso Rodriguez", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "026W", n: "WILD POPPY", i: "Flower", b: "Kenzo", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "027W", n: "L'AMOUR RARE", i: "Trésor", b: "Lancôme", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "028W", n: "ETHEREA", i: "Angel", b: "Thierry Mugler", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "029W", n: "RÊVE PARISIEN", i: "L'Eau d'Issey", b: "Issey Miyake", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "040W", n: "MAGNETIC", i: "Hypnôse", b: "Lancôme", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "042W", n: "BONHEUR SUPRÊME", i: "La Vie Est Belle", b: "Lancôme", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "047W", n: "NIGHT GEM", i: "Crystal Noir", b: "Versace", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "051W", n: "MISS BIJOU", i: "Coco Mademoiselle", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "053W", n: "VANITÉ", i: "Narciso", b: "Narciso Rodriguez", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "055W", n: "BLACK ADDICTION", i: "Black Opium", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "056W", n: "LIGHT & DARK", i: "Ange ou Démon", b: "Givenchy", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "067W", n: "VICTORIA", i: "Olympéa", b: "Paco Rabanne", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "070W", n: "PURE EGO FOR HER", i: "The One For Her", b: "D&G", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "071W", n: "SUBLIME FOR HER", i: "Allure", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "076W", n: "DEEP BLUE FOR HER", i: "Acqua Di Gioia", b: "Armani", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "080W", n: "ABSOLUTELY", i: "Sì", b: "Armani", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "081W", n: "ALLURE ÉTERNELLE", i: "Classique", b: "JPG", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "085W", n: "SERENDIPITY", i: "Chance", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "089W", n: "VILLE LUMIÈRE", i: "Mon Paris", b: "YSL", p15: "9 800", p30: "14 800", p70: "28 700" },
                ].map((row) => (
                  <tr key={row.c} className="hover:bg-[#2c1d34]/60">
                    <td className="py-1 px-1.5 font-mono font-bold text-rose-300">{row.c}</td>
                    <td className="py-1 px-1.5 font-semibold text-white">{row.n}</td>
                    <td className="py-1 px-1.5 text-amber-300 font-serif-display italic">{row.i}</td>
                    <td className="py-1 px-1.5 text-slate-400">{row.b}</td>
                    <td className="py-1 px-1.5 text-right font-mono text-emerald-400">{row.p15} F</td>
                    <td className="py-1 px-1.5 text-right font-mono text-emerald-400">{row.p30} F</td>
                    <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-400">{row.p70} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#523363] pt-2 text-[10px] text-slate-400 flex justify-between">
            <span>Prix en Francs CFA TTC · Flacons 15 ml, 30 ml et 70 ml</span>
            <span>Page 3 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 4 : TARIF FEMME (PARTIE 2) - AVEC FEMME EUROPÉENNE
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-slate-950 text-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Catalogue JAMAAL</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Tarif Femme <span className="text-base text-amber-300 font-normal">(Partie 2)</span>
                </h2>
              </div>
            </div>
            {/* Portrait femme européenne chic */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-amber-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop"
                  alt="Femme européenne élégante"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-right text-xs hidden sm:block">
                <span className="block font-bold text-amber-300">Icônes Contemporaines</span>
                <span className="text-slate-400 text-[10px]">Luxe & Séduction</span>
              </span>
            </div>
          </div>

          {/* Tableau Femme 2 */}
          <div className="mt-4 overflow-x-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-amber-400/40 text-[10px] uppercase text-amber-300 tracking-wider">
                  <th className="py-1 px-1.5 font-bold">Code</th>
                  <th className="py-1 px-1.5">Nom du Parfum</th>
                  <th className="py-1 px-1.5 text-rose-300 font-serif-display italic">Inspiré de :</th>
                  <th className="py-1 px-1.5">Maison</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">15 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">30 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">70 ML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { c: "090W", n: "FEMME FATALE", i: "Poison Girl", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "093W", n: "GLORY FOR HER", i: "Aventus For Her", b: "Creed", p15: "14 700", p30: "24 200", p70: "46 700" },
                  { c: "096W", n: "THE MUSE", i: "Gabrielle", b: "Chanel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "097W", n: "VITA", i: "Amo Ferragamo", b: "Ferragamo", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "098W", n: "EUPHORIA", i: "Joy", b: "Dior", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "115W", n: "ICON", i: "Idôle", b: "Lancôme", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "116W", n: "DECLARE", i: "Yes I Am", b: "Cacharel", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "119W", n: "DARK AFFAIR", i: "Scandal", b: "Jean Paul Gaultier", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "120W", n: "HAUTE COUTURE", i: "La Petite Robe Noire", b: "Guerlain", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "121W", n: "SECRET DESIRE", i: "L'Interdit", b: "Givenchy", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "122W", n: "VOLARE", i: "Libre", b: "YSL", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "131W", n: "CHICA MALA", i: "Good Girl", b: "Carolina Herrera", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "132W", n: "MY RULES", i: "My Way", b: "Armani", p15: "11 400", p30: "19 300", p70: "36 900" },
                  { c: "133W", n: "ENIGMA", i: "Prada Paradoxe", b: "Prada", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "145W", n: "FOREVER YOURS", i: "Devotion", b: "Dolce & Gabbana", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "148W", n: "DIVINE AURA", i: "Goddess", b: "Burberry", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "161W", n: "ETERNAL LOVE FOR HER", i: "Born In Roma Donna", b: "Valentino", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "163W", n: "BLOOMING SKIN", i: "Miu Miu", b: "Miu Miu", p15: "11 400", p30: "19 300", p70: "36 900" },
                ].map((row) => (
                  <tr key={row.c} className="hover:bg-slate-900">
                    <td className="py-2 px-1.5 font-mono font-bold text-amber-300">{row.c}</td>
                    <td className="py-2 px-1.5 font-semibold text-white">{row.n}</td>
                    <td className="py-2 px-1.5 text-rose-300 font-serif-display italic">{row.i}</td>
                    <td className="py-2 px-1.5 text-slate-400">{row.b}</td>
                    <td className="py-2 px-1.5 text-right font-mono text-emerald-400">{row.p15} F</td>
                    <td className="py-2 px-1.5 text-right font-mono text-emerald-400">{row.p30} F</td>
                    <td className="py-2 px-1.5 text-right font-mono font-bold text-emerald-400">{row.p70} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-400 flex justify-between">
            <span>Prix exprimés en Francs CFA TTC</span>
            <span>Page 4 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 5 : TARIF UNISEXE - AVEC COUPLE DIVERSITÉ
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#121820] text-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-[#233040]">
          <div className="flex items-center justify-between border-b border-[#2d3e52] pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-sky-400 font-bold">Catalogue JAMAAL</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Tarif Unisexe
                </h2>
              </div>
            </div>
            {/* Portrait couple complice et sensuel */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-sky-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?q=80&w=300&auto=format&fit=crop"
                  alt="Couple sensuel et élégant"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-right text-xs hidden sm:block">
                <span className="block font-bold text-sky-300">Harmonie Partagée</span>
                <span className="text-slate-400 text-[10px]">Pour Lui & Elle</span>
              </span>
            </div>
          </div>

          {/* Tableau Unisexe */}
          <div className="mt-6 overflow-x-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-400/40 text-[10px] uppercase text-sky-300 tracking-wider">
                  <th className="py-2 px-2 font-bold">Code</th>
                  <th className="py-2 px-2">Nom du Parfum</th>
                  <th className="py-2 px-2 text-amber-300 font-serif-display italic">Inspiré de :</th>
                  <th className="py-2 px-2">Maison</th>
                  <th className="py-2 px-2 text-right font-bold text-emerald-300">15 ML</th>
                  <th className="py-2 px-2 text-right font-bold text-emerald-300">30 ML</th>
                  <th className="py-2 px-2 text-right font-bold text-emerald-300">70 ML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a38]">
                {[
                  { c: "044U", n: "FROZEN CREST", i: "Silver Mountain", b: "Creed", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "054U", n: "NIGHT FLOWER", i: "Black Orchid", b: "Tom Ford", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "072U", n: "EARTH MEMORY", i: "Patchouli", b: "Réminiscence", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "073U", n: "THE SUMMIT", i: "Himalaya", b: "Creed", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "099U", n: "ORANGE SUN", i: "Mandarino di Amalfi", b: "Tom Ford", p15: "11 400", p30: "19 300", p70: "36 900" },
                  { c: "100U", n: "MYSTIC WOODS", i: "White Aoud", b: "Montale", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "105U", n: "EXPRESSO", i: "Intense Café", b: "Montale", p15: "9 800", p30: "14 800", p70: "28 700" },
                  { c: "110U", n: "MYSTIC SPELL", i: "Gold Kirkè", b: "Tiziana Terenzi", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "114U", n: "DESERT WHISPER", i: "Ombre Nomade", b: "Louis Vuitton", p15: "12 200", p30: "20 900", p70: "39 400" },
                  { c: "135U", n: "MYSTIC FOREST", i: "Bois d'Argent", b: "Dior", p15: "14 700", p30: "24 200", p70: "46 700" },
                  { c: "142U", n: "DARK ECLIPSE", i: "Ombré Leather", b: "Tom Ford", p15: "14 700", p30: "24 200", p70: "46 700" },
                  { c: "155U", n: "TRUE SELF", i: "CK One", b: "Calvin Klein", p15: "9 800", p30: "14 800", p70: "28 700" },
                ].map((row) => (
                  <tr key={row.c} className="hover:bg-[#1a2330]">
                    <td className="py-2.5 px-2 font-mono font-bold text-sky-300">{row.c}</td>
                    <td className="py-2.5 px-2 font-semibold text-white">{row.n}</td>
                    <td className="py-2.5 px-2 text-amber-300 font-serif-display italic">{row.i}</td>
                    <td className="py-2.5 px-2 text-slate-400">{row.b}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{row.p15} F</td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-400">{row.p30} F</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">{row.p70} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#2d3e52] pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Prix exprimés en Francs CFA TTC · Flacons 15 ml, 30 ml et 70 ml</span>
            <span>Page 5 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 6 : TARIF LUXURY & EXTRAITS RARES
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#0b0b0f] text-[#f7e6c4] rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-[#d4af37]/30">
          <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold">Haute Parfumerie Niche</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Collection Luxury & Extraits Rares
                </h2>
              </div>
            </div>
            {/* Flacons de prestige */}
            <div className="text-right">
              <span className="inline-block bg-[#d4af37]/20 border border-[#d4af37]/50 px-3 py-1 rounded-full text-xs font-bold text-[#d4af37]">
                50 ML Prestige
              </span>
            </div>
          </div>

          {/* Tableau Luxury */}
          <div className="mt-4 overflow-x-auto flex-1 text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#d4af37]/40 text-[10px] uppercase text-[#d4af37] tracking-wider">
                  <th className="py-1 px-1.5 font-bold">Code</th>
                  <th className="py-1 px-1.5">Nom du Parfum</th>
                  <th className="py-1 px-1.5 text-amber-200 font-serif-display italic">Inspiré de :</th>
                  <th className="py-1 px-1.5">Maison</th>
                  <th className="py-1 px-1.5">Genre</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">15 ML</th>
                  <th className="py-1 px-1.5 text-right font-bold text-emerald-300">50 ML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {[
                  { c: "074M", n: "ESSENCE NOIRE", i: "Black Afgano", b: "Nasomatto", g: "Homme", p15: "16 300", p50: "42 600" },
                  { c: "075",  n: "XCELLENCE", i: "X for Men", b: "Clive Christian", g: "Homme", p15: "16 300", p50: "42 600" },
                  { c: "101U", n: "SOFT CARESS", i: "Velvet Amber Skin", b: "D&G", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "106",  n: "REBEL ICON", i: "Fabulous", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "111",  n: "RUBY LOVE", i: "Lost Cherry", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "112",  n: "RIVIERA", i: "Neroli Portofino", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "117U", n: "VELVET SMOKE", i: "Tobacco Vanille", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "118U", n: "SCARLET FIRE", i: "Baccarat Rouge 540", b: "Francis Kurkdjian", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "123W", n: "SWEET REBEL", i: "Good Girl Gone Bad", b: "Kilian", g: "Femme", p15: "16 300", p50: "42 600" },
                  { c: "126",  n: "LUMIÈRE DORÉE", i: "Soleil Blanc", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "127",  n: "AGAR FOREST", i: "Oud Wood", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "129U", n: "CHLOROPHYLL", i: "Erba Pura", b: "Xerjoff", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "130U", n: "OCEANIC PULSE", i: "Megamare", b: "Orto Parisi", g: "Unisexe", p15: "18 800", p50: "53 300" },
                  { c: "134U", n: "ORANGE NECTAR", i: "Bitter Peach", b: "Tom Ford", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "137U", n: "SICILIAN GARDEN", i: "Naxos", b: "Xerjoff", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "139U", n: "SAHARA BLUSH", i: "Les Sables Roses", b: "Louis Vuitton", g: "Unisexe", p15: "18 800", p50: "53 300" },
                  { c: "141U", n: "SANDS OF TIME", i: "The Spirit of Dubai", b: "Turath", g: "Unisexe", p15: "18 800", p50: "53 300" },
                  { c: "143U", n: "SWEET DUST", i: "Vanilla Powder", b: "Matière Première", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "144U", n: "CREAMY DREAM", i: "Bianco Latte", b: "Giardini di Toscana", g: "Unisexe", p15: "16 300", p50: "42 600" },
                  { c: "NADIR", n: "NADIR", i: "Création Exclusive", b: "Olfazeta Luxury", g: "Homme", p15: "17 100", p50: "49 200" },
                  { c: "IMPERATRIX", n: "IMPERATRIX", i: "Création Exclusive", b: "Olfazeta Luxury", g: "Femme", p15: "17 100", p50: "49 200" },
                ].map((row) => (
                  <tr key={row.c} className="hover:bg-slate-900/60">
                    <td className="py-1 px-1.5 font-mono font-bold text-[#d4af37]">{row.c}</td>
                    <td className="py-1 px-1.5 font-semibold text-white">{row.n}</td>
                    <td className="py-1 px-1.5 text-amber-200 font-serif-display italic">{row.i}</td>
                    <td className="py-1 px-1.5 text-slate-400">{row.b}</td>
                    <td className="py-1 px-1.5 text-slate-400">{row.g}</td>
                    <td className="py-1 px-1.5 text-right font-mono text-emerald-400">{row.p15} F</td>
                    <td className="py-1 px-1.5 text-right font-mono font-bold text-[#d4af37]">{row.p50} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#d4af37]/30 pt-2 text-[10px] text-slate-400 flex justify-between">
            <span>Collection Prestige 50 ML en flaconnage lourd de luxe · Prix FCFA TTC</span>
            <span>Page 6 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 7 : VAPORISATEURS & ÉCRINS DE SAC
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#1c1815] text-[#f7eee6] rounded-3xl p-8 shadow-2xl relative flex flex-col justify-between min-h-[750px] border border-[#d4af37]/30">
          <div>
            <div className="text-center border-b border-[#d4af37]/30 pb-4">
              <div className="inline-block bg-white p-2 rounded-xl shadow-md mx-auto mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain mx-auto" />
              </div>
              <span className="block text-xs uppercase tracking-widest text-[#d4af37] font-bold">Accessoire Nomade Chic</span>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-white mt-1">
                Écrins & Vaporisateurs de Sac
              </h2>
              <p className="text-xs text-[#ecdacf]/80 mt-1">
                Pratique et compact · Étui pour recharges de parfum spray 15 ml
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {/* Modèle Fantaisie */}
              <div className="bg-white/5 border border-[#d4af37]/20 p-5 rounded-3xl text-center flex flex-col items-center">
                <div className="h-40 w-40 rounded-2xl overflow-hidden mb-4 shadow-xl border border-white/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://images.unsplash.com/photo-1547887537-6158d64c35b3?q=80&w=400&auto=format&fit=crop" alt="Boîtiers fantaisie" className="h-full w-full object-cover" />
                </div>
                <h3 className="font-serif-display text-lg font-bold text-white">Modèles Fantaisie & Couleurs</h3>
                <p className="text-xs text-slate-400 mt-1">Finition satinée douce, coloris pastel et vifs</p>
                <p className="mt-4 text-xl font-bold font-mono text-emerald-400">10 700 FCFA</p>
                <span className="text-[10px] text-slate-500">Rechargeable avec tous les flacons 15 ml</span>
              </div>

              {/* Modèle Métal Luxe */}
              <div className="bg-white/5 border border-[#d4af37]/20 p-5 rounded-3xl text-center flex flex-col items-center">
                <div className="h-40 w-40 rounded-2xl overflow-hidden mb-4 shadow-xl border border-[#d4af37]/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=400&auto=format&fit=crop" alt="Boîtiers métal luxe" className="h-full w-full object-cover" />
                </div>
                <h3 className="font-serif-display text-lg font-bold text-[#d4af37]">Modèles Aluminium & Or Rose</h3>
                <p className="text-xs text-slate-400 mt-1">Aluminium brossé anodisé, étui haute résistance</p>
                <p className="mt-4 text-xl font-bold font-mono text-emerald-400">12 300 FCFA</p>
                <span className="text-[10px] text-slate-500">Rechargeable avec tous les flacons 15 ml</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#d4af37]/30 pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Votre parfum préféré toujours avec vous dans votre sac ou poche</span>
            <span>Page 7 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 8 : GELS DOUCHE PARFUMÉS
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col min-h-[750px] border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Hygiène & Bien-Être</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  Gels Douche Parfumés
                </h2>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-300">Format 250 ML</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 flex-1 text-[11px]">
            {/* Ligne Femme */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              <h3 className="font-serif-display text-sm font-bold text-rose-300 mb-2 border-b border-rose-900/40 pb-1 flex justify-between">
                <span>Gamme Femme</span>
                <span className="font-mono text-emerald-400">13 000 FCFA</span>
              </h3>
              <ul className="space-y-1.5">
                {[
                  { c: "BSF 007", i: "J'adore · Dior" },
                  { c: "BSF 010", i: "Alien · Mugler" },
                  { c: "BSF 019", i: "Lady Million · Paco Rabanne" },
                  { c: "BSF 023", i: "Hypnotic Poison · Dior" },
                  { c: "BSF 042", i: "La Vie Est Belle · Lancôme" },
                  { c: "BSF 051", i: "Coco Mademoiselle · Chanel" },
                  { c: "BSF 055", i: "Black Opium · YSL" },
                  { c: "BSF 080", i: "Sì · Armani" },
                  { c: "BSF 119", i: "Scandal · JPG" },
                  { c: "BSF 121", i: "L'Interdit · Givenchy" },
                ].map((item) => (
                  <li key={item.c} className="flex justify-between items-center text-slate-300">
                    <span className="font-mono font-bold text-rose-300 text-[10px]">{item.c}</span>
                    <span className="font-serif-display italic text-slate-200">{item.i}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ligne Homme */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
              <h3 className="font-serif-display text-sm font-bold text-sky-300 mb-2 border-b border-sky-900/40 pb-1 flex justify-between">
                <span>Gamme Homme</span>
                <span className="font-mono text-emerald-400">13 000 FCFA</span>
              </h3>
              <ul className="space-y-1.5">
                {[
                  { c: "BSF 001", i: "One Million · Paco Rabanne" },
                  { c: "BSF 002", i: "Acqua Di Gio' · Armani" },
                  { c: "BSF 003", i: "Fahrenheit · Dior" },
                  { c: "BSF 005", i: "Hugo Man · Hugo Boss" },
                  { c: "BSF 016", i: "Le Male · JPG" },
                  { c: "BSF 020", i: "La Nuit de L'Homme · YSL" },
                  { c: "BSF 033", i: "Black Code · Armani" },
                  { c: "BSF 061", i: "Invictus · Paco Rabanne" },
                  { c: "BSF 068", i: "Aventus · Creed" },
                  { c: "BSF 094", i: "Sauvage · Dior" },
                ].map((item) => (
                  <li key={item.c} className="flex justify-between items-center text-slate-300">
                    <span className="font-mono font-bold text-sky-300 text-[10px]">{item.c}</span>
                    <span className="font-serif-display italic text-slate-200">{item.i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Gamme Luxury Shower Gel */}
          <div className="mt-4 bg-slate-950/90 border border-amber-400/30 p-3.5 rounded-2xl text-[11px]">
            <h4 className="font-serif-display font-bold text-amber-300 mb-2 text-xs">Gamme Luxury & Niche</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 111 (Lost Cherry)</span>
                <span className="font-bold text-emerald-400">15 500 F</span>
              </div>
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 118 (Baccarat Rouge)</span>
                <span className="font-bold text-emerald-400">15 500 F</span>
              </div>
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 129 (Erba Pura)</span>
                <span className="font-bold text-emerald-400">15 500 F</span>
              </div>
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 130 (Megamare)</span>
                <span className="font-bold text-emerald-400">20 400 F</span>
              </div>
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 134 (Bitter Peach)</span>
                <span className="font-bold text-emerald-400">15 500 F</span>
              </div>
              <div className="flex justify-between bg-white/5 p-1.5 rounded-lg">
                <span>BSF 105 (Intense Café)</span>
                <span className="font-bold text-emerald-400">13 000 F</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 mt-4 text-[10px] text-slate-400 flex justify-between">
            <span>Formule enrichie, nettoie en douceur et laisse un sillage persistant</span>
            <span>Page 8 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 9 : CRÈMES CORPS - AVEC FEMME AFRO-DESCENDANTE
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#1e1511] text-[#f7ede5] rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between min-h-[750px] border border-[#a87352]/30">
          <div>
            <div className="flex items-center justify-between border-b border-[#a87352]/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-white p-1 rounded-lg shadow-sm shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold">Soins & Beauté Corps</span>
                  <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white tracking-wide">
                    Crèmes Corps Parfumées
                  </h2>
                </div>
              </div>
              {/* Photo femme afro-descendante peau éclatante */}
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&auto=format&fit=crop"
                    alt="Peau soyeuse femme afro-descendante"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="text-right text-xs hidden sm:block">
                  <span className="block font-bold text-[#d4af37]">Format 150 ML</span>
                  <span className="text-emerald-400 font-mono font-bold">14 700 FCFA</span>
                </span>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-[#a87352]/30 text-xs text-[#ecdacf] leading-relaxed">
              ✨ <strong>Formule d&apos;exception :</strong> Enrichie en <strong>huile d&apos;argan</strong>, <strong>huile d&apos;amande douce</strong> et <strong>protéines de soie</strong>. Hydrate intensément, illumine les peaux sèches et dépose un sillage soyeux fidèle à votre parfum préféré.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
              {[
                { c: "CRF 007", n: "J'adore", b: "Dior" },
                { c: "CRF 010", n: "Alien", b: "Thierry Mugler" },
                { c: "CRF 019", n: "Lady Million", b: "Paco Rabanne" },
                { c: "CRF 023", n: "Hypnotic Poison", b: "Dior" },
                { c: "CRF 042", n: "La Vie Est Belle", b: "Lancôme" },
                { c: "CRF 051", n: "Coco Mademoiselle", b: "Chanel" },
                { c: "CRF 055", n: "Black Opium", b: "YSL" },
                { c: "CRF 080", n: "Sì", b: "Armani" },
                { c: "CRF 119", n: "Scandal", b: "Jean Paul Gaultier" },
                { c: "CRF 121", n: "L'Interdit", b: "Givenchy" },
              ].map((item) => (
                <div key={item.c} className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-[#a87352]/20">
                  <div>
                    <span className="font-mono font-bold text-[#d4af37] text-xs">{item.c}</span>
                    <p className="font-serif-display font-semibold text-white mt-0.5">{item.n}</p>
                    <p className="text-[10px] text-slate-400">{item.b}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-xs">14 700 FCFA</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#a87352]/30 pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Idéal en superposition après la douche pour faire durer le parfum toute la journée</span>
            <span>Page 9 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 10 : COLLECTION SCENTED LOVE
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#18090b] text-[#fce8eb] rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between min-h-[750px] border border-rose-900/40">
          <div>
            <div className="text-center border-b border-rose-900/40 pb-3">
              <div className="inline-block bg-white p-2 rounded-xl shadow-md mx-auto mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain mx-auto" />
              </div>
              <span className="block text-[10px] uppercase tracking-widest text-rose-400 font-bold">Édition Passion</span>
              <h2 className="font-serif-display text-3xl font-bold text-white mt-1">
                Collection Scented Love
              </h2>
              <p className="text-xs text-rose-300/80 mt-1">
                Flacons Cœur Rouge Passion 25 ML avec Pyramide Olfactive
              </p>
            </div>

            <div className="space-y-4 mt-6 text-xs">
              {/* LOVE22 */}
              <div className="bg-rose-950/40 border border-rose-800/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-rose-400 text-sm">LOVE22 (Pour Elle · 25 ml)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">16 300 FCFA</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Notes de Tête :</strong> Anis Étoilé, Bergamote, Cerise, Amande<br />
                  <strong>Notes de Cœur :</strong> Réglisse, Pêche, Rose, Rose Bulgare<br />
                  <strong>Notes de Fond :</strong> Anis, Cèdre, Fève Tonka, Musc, Vanille Gourmande
                </p>
              </div>

              {/* LOVE24 */}
              <div className="bg-rose-950/40 border border-rose-800/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-rose-400 text-sm">LOVE24 (Pour Elle · 25 ml)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">20 400 FCFA</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Notes de Tête :</strong> Bergamote, Framboise, Mandarine, Osmanthus<br />
                  <strong>Notes de Cœur :</strong> Fleur de Gingembre, Jasmin, Rose, Tubéreuse<br />
                  <strong>Notes de Fond :</strong> Ambre, Caramel, Cèdre, Réglisse, Patchouli, Santal, Vanille
                </p>
              </div>

              {/* LOVE25 */}
              <div className="bg-rose-950/40 border border-rose-800/40 p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-rose-400 text-sm">LOVE25 (Pour Elle · 25 ml)</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">20 400 FCFA</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Notes de Tête :</strong> Abricot, Orange Amère, Noix de Coco, Citron, Prune<br />
                  <strong>Notes de Cœur :</strong> Fleur d&apos;Oranger, Jasmin, Muguet, Rose, Tubéreuse<br />
                  <strong>Notes de Fond :</strong> Fève Tonka, Amande, Musc, Santal, Vanille
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-rose-900/40 pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Le cadeau d&apos;amour et de séduction par excellence</span>
            <span>Page 10 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 11 : GAMME ENFANTS & BÉBÉ
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#121a1f] text-slate-100 rounded-3xl p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between min-h-[750px] border border-teal-900/40">
          <div>
            <div className="text-center border-b border-teal-900/40 pb-3">
              <div className="inline-block bg-white p-2 rounded-xl shadow-md mx-auto mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="h-8 w-auto rounded object-contain mx-auto" />
              </div>
              <span className="block text-[10px] uppercase tracking-widest text-teal-400 font-bold">Douceur & Tendresse</span>
              <h2 className="font-serif-display text-3xl font-bold text-white mt-1">
                Collection Enfants & Bébé
              </h2>
              <p className="text-xs text-teal-300/80 mt-1">
                Formules Hypoallergéniques · Sans alcool agressif · Testé sous contrôle pédiatrique
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-10">
              {/* Garçon */}
              <div className="bg-slate-950/60 border border-blue-500/30 p-5 rounded-3xl text-center flex flex-col items-center">
                <span className="h-16 w-16 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-2xl mb-3">
                  👶
                </span>
                <span className="font-mono font-bold text-blue-300 text-sm">Code : 045</span>
                <h3 className="font-serif-display text-base font-bold text-white mt-1">Parfum Garçon</h3>
                <p className="text-[11px] text-slate-400 mt-1">Fragrance fraîche et stimulante</p>
                <p className="mt-4 text-base font-bold font-mono text-emerald-400">23 800 FCFA</p>
                <span className="text-[10px] text-slate-500">Flacon spray 30 ML</span>
              </div>

              {/* Fille */}
              <div className="bg-slate-950/60 border border-pink-500/30 p-5 rounded-3xl text-center flex flex-col items-center">
                <span className="h-16 w-16 rounded-full bg-pink-500/20 border-2 border-pink-400 flex items-center justify-center text-2xl mb-3">
                  👧
                </span>
                <span className="font-mono font-bold text-pink-300 text-sm">Code : 058</span>
                <h3 className="font-serif-display text-base font-bold text-white mt-1">Parfum Fille</h3>
                <p className="text-[11px] text-slate-400 mt-1">Notes florales douces et poudrées</p>
                <p className="mt-4 text-base font-bold font-mono text-emerald-400">23 800 FCFA</p>
                <span className="text-[10px] text-slate-500">Flacon spray 30 ML</span>
              </div>

              {/* Bébé */}
              <div className="bg-slate-950/60 border border-amber-500/30 p-5 rounded-3xl text-center flex flex-col items-center">
                <span className="h-16 w-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl mb-3">
                  🍼
                </span>
                <span className="font-mono font-bold text-amber-300 text-sm">Code : 059</span>
                <h3 className="font-serif-display text-base font-bold text-white mt-1">Nouveau-Né</h3>
                <p className="text-[11px] text-slate-400 mt-1">Caresse d&apos;eau douce et fleur d&apos;oranger</p>
                <p className="mt-4 text-base font-bold font-mono text-emerald-400">23 800 FCFA</p>
                <span className="text-[10px] text-slate-500">Flacon spray 30 ML</span>
              </div>
            </div>
          </div>

          <div className="border-t border-teal-900/40 pt-3 text-[10px] text-slate-400 flex justify-between">
            <span>Dès les premiers mois · Respect total de la peau délicate</span>
            <span>Page 11 / 12</span>
          </div>
        </article>

        {/* ═════════════════════════════════════════════════════════════════
            PAGE 12 : FICHE CONTACT CONSEILLER REVENDEUR
            ═════════════════════════════════════════════════════════════════ */}
        <article className="catalogue-page bg-[#1f1713] text-[#f7ede5] rounded-3xl p-8 sm:p-12 shadow-2xl relative flex flex-col justify-between min-h-[750px] border-2 border-[#d4af37]/40">
          <div className="text-center">
            {/* Logo */}
            <div className="inline-block bg-white p-2.5 rounded-2xl shadow-xl mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/jamaal-logo.jpg" alt="JAMAAL Luxury Cosmetics" className="h-14 w-auto rounded-lg mx-auto" />
            </div>

            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-white">
              Votre Conseiller Personnel
            </h2>
            <p className="text-xs text-[#d4af37] tracking-wider uppercase mt-1">
              Commande express, conseils parfumés & livraison à domicile
            </p>
          </div>

          {/* Cartouche Contact Revendeur */}
          <div className="my-8 bg-white/95 text-slate-900 p-8 rounded-3xl shadow-2xl border-2 border-[#d4af37] max-w-md mx-auto w-full">
            <h3 className="font-serif-display text-center text-lg font-bold text-slate-900 border-b pb-3 mb-5">
              Fiche Contact & Commande
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase text-[10px] w-24">Conseiller(ère) :</span>
                <span className="font-bold text-sm text-slate-900">{name}</span>
              </div>

              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase text-[10px] w-24">WhatsApp / Tél :</span>
                <span className="font-bold text-sm text-[#25D366] font-mono">{phone}</span>
              </div>

              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase text-[10px] w-24">Secteur :</span>
                <span className="font-medium text-slate-800">{city} & Tout le Sénégal</span>
              </div>

              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500 uppercase text-[10px] w-24">Boutique Web :</span>
                <span className="font-mono font-bold text-rose-dark">{siteUrl}</span>
              </div>
            </div>

            <div className="mt-6 text-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600">
              💬 <em>Envoyez simplement le code ou le nom du parfum par WhatsApp pour recevoir votre commande le jour même !</em>
            </div>
          </div>

          {/* Slogan final de clôture */}
          <div className="text-center border-t border-[#d4af37]/30 pt-4">
            <p className="font-serif-display text-xs tracking-widest uppercase text-[#ecdacf]/80">
              « Un parfum ne se porte pas, il se vit. »
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              JAMAAL Luxury Cosmetics · Distributeur Officiel au Sénégal · Dakar
            </p>
          </div>
        </article>

      </div>
    </div>
  );
}
