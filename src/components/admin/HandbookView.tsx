"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  Download,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Contact,
  Send,
} from "lucide-react";
import { formatPrice } from "@/lib/currency";
import type { StockRow } from "@/lib/inventory-report";

interface HandbookViewProps {
  rows: StockRow[];
  refSlug: string | null;
  consultantName: string | null;
}

export function HandbookView({ rows, refSlug, consultantName }: HandbookViewProps) {
  const [q, setQ] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"stock" | "code" | "name" | "price">("stock");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [contactPhone, setContactPhone] = useState("");
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Catégories uniques
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.categoryLabel) set.add(r.categoryLabel);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Statistiques globales
  const stats = useMemo(() => {
    const inStock = rows.filter((r) => r.stock > 0);
    const lowStock = rows.filter((r) => r.stock > 0 && r.stock <= 5);
    const outOfStock = rows.filter((r) => r.stock <= 0);
    const totalUnits = inStock.reduce((acc, r) => acc + r.stock, 0);
    return {
      availableCount: inStock.length,
      totalUnits,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };
  }, [rows]);

  // Filtrage et tri
  const filtered = useMemo(() => {
    let list = rows;

    if (onlyAvailable) {
      list = list.filter((r) => r.stock > 0);
    }

    if (selectedCategory !== "ALL") {
      list = list.filter((r) => r.categoryLabel === selectedCategory);
    }

    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((r) => {
        const pCode = (r.productCode || "").toLowerCase();
        const fCode = (r.code || "").toLowerCase();
        const name = (r.name || "").toLowerCase();
        const inspired = (r.inspiredBy || "").toLowerCase();
        const brand = (r.inspiredBrand || "").toLowerCase();
        const format = (r.format || "").toLowerCase();
        return (
          pCode.includes(query) ||
          fCode.includes(query) ||
          name.includes(query) ||
          inspired.includes(query) ||
          brand.includes(query) ||
          format.includes(query)
        );
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === "stock") return b.stock - a.stock;
      if (sortBy === "code") return (a.productCode || "").localeCompare(b.productCode || "");
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return (b.salePrice || 0) - (a.salePrice || 0);
      return 0;
    });
  }, [rows, onlyAvailable, selectedCategory, q, sortBy]);

  // Copier une référence individuelle
  const copyRow = (row: StockRow) => {
    const text = [
      row.productCode ? `[Code: ${row.productCode}]` : null,
      row.name,
      row.format && row.format !== "Format unique" ? `(${row.format})` : null,
      row.inspiredBy ? `- Inspiré de ${row.inspiredBy}` : null,
      row.salePrice ? `- ${formatPrice(row.salePrice)}` : null,
      row.stock > 0 ? `🟢 DISPONIBLE À DAKAR (${row.stock} en stock)` : "🔴 RUPTURE",
    ]
      .filter(Boolean)
      .join(" ");

    navigator.clipboard?.writeText(text);
    setCopiedKey(row.key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // WhatsApp individuel
  const waLink = (row: StockRow) => {
    const first = consultantName?.split(/\s+/)[0] || "";
    const intro = first ? `Bonjour ! C'est ${first} de JAMAAL.` : "Bonjour !";
    const insp = row.inspiredBy ? ` (inspiré de *${row.inspiredBy}*)` : "";
    const code = row.productCode ? ` [Code: ${row.productCode}]` : "";
    const fmt = row.format && row.format !== "Format unique" ? ` en ${row.format}` : "";
    const prx = row.salePrice ? ` au prix de *${formatPrice(row.salePrice)}*` : "";
    const msg = `${intro} Le produit *${row.name}*${insp}${fmt}${code} est bien *DISPONIBLE EN STOCK À DAKAR* (${row.stock} pièce${row.stock > 1 ? "s" : ""} restante${row.stock > 1 ? "s" : ""})${prx}.\n\nSouhaitez-vous que je vous le fasse livrer aujourd'hui ? 🌸`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  function toggleSelected(row: StockRow) {
    if (row.stock <= 0) return;
    setSelectedKeys((current) => current.includes(row.key)
      ? current.filter((key) => key !== row.key)
      : [...current, row.key]);
  }

  async function choosePhoneContact() {
    const contactsApi = (navigator as Navigator & {
      contacts?: { select: (properties: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
    }).contacts;
    if (!contactsApi) {
      setShareNotice("Le carnet de contacts est disponible sur certains téléphones Android avec Chrome. Saisissez le numéro WhatsApp du client ci-dessous.");
      return;
    }
    try {
      const contacts = await contactsApi.select(["name", "tel"], { multiple: false });
      const phone = contacts[0]?.tel?.[0];
      if (phone) {
        setContactPhone(phone);
        setShareNotice(`Contact sélectionné : ${contacts[0]?.name?.[0] || phone}. Appuyez sur « Envoyer sur WhatsApp » pour continuer.`);
      }
    } catch {
      setShareNotice("Sélection annulée. Vous pouvez saisir le numéro WhatsApp du client.");
    }
  }

  function shareSelected() {
    const selectedRows = rows.filter((row) => selectedKeys.includes(row.key) && row.stock > 0);
    if (!selectedRows.length) {
      setShareNotice("Sélectionnez au moins un produit disponible en stock.");
      return;
    }
    const digits = contactPhone.replace(/\D/g, "").replace(/^00/, "");
    if (contactPhone.trim() && digits.length < 9) {
      setShareNotice("Le numéro saisi semble incomplet. Vérifiez le numéro WhatsApp du client.");
      return;
    }
    const lines = selectedRows.map((row) => {
      const url = new URL(`/produits/${row.slug}${refSlug ? `?ref=${encodeURIComponent(refSlug)}` : ""}`, window.location.origin).toString();
      const format = row.format && row.format !== "Format unique" ? ` (${row.format})` : "";
      const price = row.salePrice ? ` — ${formatPrice(row.salePrice)}` : "";
      return `• ${row.name}${format}${price}\n${url}`;
    });
    const message = `Bonjour ! Voici les produits disponibles que je vous propose :\n\n${lines.join("\n\n")}\n\nDites-moi si vous souhaitez passer commande. 🌸`;
    const target = digits.length === 9 ? `221${digits}` : digits;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setShareNotice("WhatsApp s’est ouvert avec les fiches d’achat. Vérifiez le message puis appuyez sur Envoyer.");
  }

  // Exporter en CSV
  const exportCsv = () => {
    const headers = [
      "Code Chogan",
      "Nom du produit",
      "Contenance / Format",
      "Inspiré de",
      "Maison / Marque",
      "Catégorie",
      "Stock Dakar",
      "Statut",
      "Prix Vente FCFA",
    ];
    const lines = filtered.map((r) => [
      `"${r.productCode || ""}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.format}"`,
      `"${(r.inspiredBy || "").replace(/"/g, '""')}"`,
      `"${(r.inspiredBrand || "").replace(/"/g, '""')}"`,
      `"${r.categoryLabel || ""}"`,
      r.stock,
      `"${r.stock > 0 ? "Disponible" : "Rupture"}"`,
      r.salePrice || 0,
    ]);

    const csvContent = [headers.join(";"), ...lines.map((l) => l.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `handbook-stocks-dakar-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── BANDEAU EN-TÊTE ────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-line bg-gradient-to-br from-[#16233a] via-[#1c2c48] to-[#0e1726] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-rose-light backdrop-blur-md">
              <Sparkles size={12} className="text-amber-400" />
              Dépôt officiel Dakar · Instant T
            </span>
            <h1 className="mt-2 font-serif-display text-2xl font-bold tracking-wide sm:text-3xl">
              Produits disponibles
            </h1>
            <p className="mt-1 text-sm text-white/80 max-w-xl">
              Choisissez un ou plusieurs produits en stock et envoyez à votre client un lien direct pour découvrir et commander chaque produit.
            </p>
          </div>

          {/* Actions d'export */}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition"
            >
              <Download size={15} />
              Exporter Excel
            </button>
          </div>
        </div>

        {/* Compteurs KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-white/70">Disponibles à Dakar</p>
            <p className="mt-1 font-serif-display text-2xl font-bold text-emerald-300">
              {stats.availableCount} <span className="text-xs font-sans text-white/60">références</span>
            </p>
            <p className="text-[11px] text-white/60">{stats.totalUnits} flacons prêts à livrer</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-white/70">Stock faible (&lt; 5)</p>
            <p className="mt-1 font-serif-display text-2xl font-bold text-amber-300">
              {stats.lowStockCount} <span className="text-xs font-sans text-white/60">références</span>
            </p>
            <p className="text-[11px] text-white/60">Dernières unités</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-white/70">Ruptures</p>
            <p className="mt-1 font-serif-display text-2xl font-bold text-rose-300">
              {stats.outOfStockCount} <span className="text-xs font-sans text-white/60">références</span>
            </p>
            <p className="text-[11px] text-white/60">En réapprovisionnement</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-white/70">Actualisation</p>
            <p className="mt-1 font-serif-display text-xl font-bold text-white">
              Direct live
            </p>
            <p className="text-[11px] text-white/60">Sync temps réel base</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={choosePhoneContact} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">
            <Contact size={16} /> Choisir un contact du téléphone
          </button>
          <input type="tel" inputMode="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Numéro WhatsApp du client" aria-label="Numéro WhatsApp du client" className="min-w-56 flex-1 rounded-full border border-line px-4 py-2 text-sm" />
          <button type="button" onClick={shareSelected} disabled={!selectedKeys.length} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Send size={16} /> Envoyer {selectedKeys.length ? `${selectedKeys.length} produit${selectedKeys.length > 1 ? "s" : ""}` : "sur WhatsApp"}
          </button>
        </div>
        <p className="mt-2 text-xs text-navy/60">Le sélecteur du téléphone dépend du navigateur. Si le bouton ne peut pas ouvrir vos contacts, saisissez le numéro. WhatsApp demandera de confirmer l’envoi.</p>
        {shareNotice && <p role="status" className="mt-2 text-xs font-medium text-navy/80">{shareNotice}</p>}
      </section>

      {/* ── BARRE DE RECHERCHE & FILTRES ──────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/40" size={17} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher : Code Chogan (ex: 024, 094M), Nom, Inspiration (Black Opium, Sauvage...), Format..."
              className="w-full rounded-full border border-line bg-cream/30 py-2.5 pl-10 pr-4 text-sm text-navy placeholder:text-navy/40 outline-none focus:border-navy focus:bg-white"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-navy/50 hover:text-navy"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tri */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy/60 font-medium">Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-navy outline-none"
            >
              <option value="stock">Quantité disponible (décroissant)</option>
              <option value="code">Code Chogan</option>
              <option value="name">Nom du produit</option>
              <option value="price">Prix</option>
            </select>
          </div>
        </div>

        {/* Filtres de disponibilité et catégories */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
          {/* Toggle en stock */}
          <button
            type="button"
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              onlyAvailable
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-line text-navy hover:bg-cream"
            }`}
          >
            <span>🟢</span>
            En stock uniquement ({stats.availableCount})
          </button>

          <button
            type="button"
            onClick={() => setOnlyAvailable(false)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              !onlyAvailable
                ? "bg-navy text-white shadow-sm"
                : "border border-line text-navy hover:bg-cream"
            }`}
          >
            Tout voir (avec ruptures)
          </button>

          <span className="text-navy/30">|</span>

          {/* Pilules de catégories */}
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedCategory === "ALL"
                ? "bg-navy/10 text-navy font-bold"
                : "text-navy/70 hover:text-navy hover:bg-cream"
            }`}
          >
            Toutes ({rows.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedCategory === cat
                  ? "bg-navy/10 text-navy font-bold"
                  : "text-navy/70 hover:text-navy hover:bg-cream"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTE DES RÉSULTATS ────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="border-b border-line bg-cream/60 px-4 py-3 flex items-center justify-between text-xs font-semibold text-navy/70">
          <span>{filtered.length} article{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}</span>
          <span className="italic text-navy/50">Dépôt Dakar · Mis à jour en direct</span>
        </div>

        <div className="divide-y divide-line">
          {filtered.map((r) => {
            const isCopied = copiedKey === r.key;
            const wa = waLink(r);
            const inStock = r.stock > 0;
            const isLow = inStock && r.stock <= 5;
            const productHref = `/produits/${r.slug}${refSlug ? `?ref=${refSlug}` : ""}`;
            const isSelected = selectedKeys.includes(r.key);

            return (
              <div
                key={r.key}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-cream/20 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Infos produit */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <input type="checkbox" aria-label={`Sélectionner ${r.name} ${r.format}`} checked={isSelected} disabled={!inStock} onChange={() => toggleSelected(r)} className="mt-2 h-4 w-4 shrink-0 accent-emerald-600 disabled:opacity-30" />
                  {/* Code Chogan badge */}
                  <div className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-navy/5 border border-navy/10 px-2.5 py-1.5 min-w-[54px] text-center">
                    <span className="font-mono text-xs font-bold text-navy">
                      {r.productCode || r.code || "—"}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-navy/50 font-semibold">
                      Chogan
                    </span>
                  </div>

                  {/* Nom, inspiration, format */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={productHref}
                        className="font-semibold text-navy hover:underline text-sm sm:text-base leading-tight"
                      >
                        {r.name}
                      </Link>
                      {r.format && r.format !== "Format unique" && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {r.format}
                        </span>
                      )}
                      <span className="text-[11px] text-navy/40">· {r.categoryLabel}</span>
                    </div>

                    {/* Inspiration olfactive */}
                    {r.inspiredBy && (
                      <p className="mt-1 text-xs text-rose-dark font-medium italic">
                        Inspiré de : <span className="font-semibold">{r.inspiredBy}</span>
                        {r.inspiredBrand && <span className="text-navy/50 font-normal"> ({r.inspiredBrand})</span>}
                      </p>
                    )}

                    {/* Stock et Disponibilité */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {inStock ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isLow
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isLow ? "bg-amber-500" : "bg-emerald-500"}`} />
                          {r.stock} dispo à Dakar {isLow ? "(dernières pièces)" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          Rupture temporaire
                        </span>
                      )}

                      {r.salePrice && (
                        <span className="font-semibold text-navy text-sm">
                          {formatPrice(r.salePrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions rapides */}
                <div className="flex items-center gap-2 shrink-0 sm:self-center">
                  {/* WhatsApp client */}
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Envoyer la disponibilité à un client sur WhatsApp"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#20ba59] transition"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </a>

                  {/* Copier la référence */}
                  <button
                    type="button"
                    onClick={() => copyRow(r)}
                    title="Copier la référence et le stock"
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream transition"
                  >
                    {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{isCopied ? "Copié !" : "Copier"}</span>
                  </button>

                  {/* Fiche produit */}
                  <Link
                    href={productHref}
                    target="_blank"
                    title="Voir la fiche sur la boutique"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-line text-navy/60 hover:text-navy hover:bg-cream transition"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-12 text-center text-navy/60">
              <BookOpen size={36} className="mx-auto text-navy/30 mb-2" />
              <p className="font-semibold text-navy">Aucun produit ne correspond à votre recherche.</p>
              <p className="text-xs mt-1">Essayez un autre mot-clé ou désactivez le filtre &quot;En stock uniquement&quot;.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const BibleView = HandbookView;
