"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { fillScript, type SalesScript } from "@/data/sales-scripts";

export function ScriptCard({
  script,
  personalLink,
  consultantName,
}: {
  script: SalesScript;
  personalLink: string;
  consultantName?: string;
}) {
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () =>
      fillScript(script.body, {
        name: name || undefined,
        link: personalLink,
        product: product || undefined,
      }),
    [script.body, name, product, personalLink]
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">{script.title}</h3>
          <p className="mt-0.5 text-xs text-navy/70">{script.description}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Prénom du client (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs outline-none focus:border-navy"
        />
        <input
          placeholder="Nom du produit (optionnel)"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs outline-none focus:border-navy"
        />
      </div>

      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-navy/5 p-3 text-xs leading-relaxed text-navy/90">
        {text}
      </pre>

      {consultantName && (
        <p className="mt-2 text-xs text-navy/65">
          Lien utilisé : {personalLink} · {consultantName}
        </p>
      )}
    </article>
  );
}
