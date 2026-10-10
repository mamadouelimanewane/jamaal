"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { saveManualEntryAction } from "@/lib/actions/accounting";

type L = { account: string; label: string; aux: string; debit: string; credit: string };
type Account = { code: string; label: string };

const empty = (): L => ({ account: "", label: "", aux: "", debit: "", credit: "" });
const n = (s: string) => Math.round(Number(s.replace(/[\s .]/g, "").replace(",", ".")) || 0);
const f = "w-full rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-navy";

/** Modèles d'écritures courantes : comptes préremplis, il reste le montant. */
const TEMPLATES: { id: string; label: string; journal: string; lines: [string, "D" | "C"][]; hint: string }[] = [
  { id: "", label: "Écriture libre", journal: "OD", lines: [["", "D"], ["", "C"]], hint: "Saisissez les comptes et les montants." },
  { id: "APPORT", label: "Apport de l'exploitant", journal: "BQ", lines: [["571", "D"], ["104", "C"]], hint: "Argent personnel mis dans l'activité. Changez 571 (caisse) pour 5521 (Wave), 5522 (Orange Money) ou 521 (banque)." },
  { id: "PRELEVEMENT", label: "Prélèvement de l'exploitant", journal: "BQ", lines: [["104", "D"], ["571", "C"]], hint: "Argent retiré de l'activité pour un usage personnel." },
  { id: "VIREMENT", label: "Virement entre comptes", journal: "BQ", lines: [["521", "D"], ["5521", "C"]], hint: "Ex. transfert de Wave vers la banque : la banque (débit) reçoit, Wave (crédit) donne." },
  { id: "FRAIS", label: "Frais bancaires / mobile money", journal: "BQ", lines: [["631", "D"], ["5521", "C"]], hint: "Frais de retrait, de transfert ou de tenue de compte." },
  { id: "EMPRUNT", label: "Emprunt reçu", journal: "BQ", lines: [["521", "D"], ["162", "C"]], hint: "Prêt versé par une banque ou une institution de microfinance." },
  { id: "REMB_EMPRUNT", label: "Échéance d'emprunt", journal: "BQ", lines: [["162", "D"], ["671", "D"], ["521", "C"]], hint: "Capital remboursé (162) + intérêts (671)." },
  { id: "OUVERTURE", label: "Solde d'ouverture d'un compte", journal: "AN", lines: [["521", "D"], ["104", "C"]], hint: "Ce qu'il y avait sur le compte au début de la comptabilité." },
  { id: "AMORT", label: "Dotation aux amortissements", journal: "OD", lines: [["681", "D"], ["2844", "C"]], hint: "Usure annuelle du matériel (ex. 1/5 du prix d'achat d'un ordinateur par an)." },
];

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer l'écriture"}</button>;
}

export function ManualEntryForm({
  accounts,
  initial,
  today,
}: {
  accounts: Account[];
  today: string;
  initial?: { id: string; date: string; journal: string; label: string; reference: string; template: string; lines: { account: string; label?: string; aux?: string; debit: number; credit: number }[] };
}) {
  const [template, setTemplate] = useState(initial?.template ?? "");
  const [journal, setJournal] = useState(initial?.journal ?? "OD");
  const [lines, setLines] = useState<L[]>(
    initial?.lines.length
      ? initial.lines.map((l) => ({ account: l.account, label: l.label ?? "", aux: l.aux ?? "", debit: l.debit ? String(l.debit) : "", credit: l.credit ? String(l.credit) : "" }))
      : [empty(), empty()]
  );
  const [amount, setAmount] = useState("");
  const labels = useMemo(() => new Map(accounts.map((a) => [a.code, a.label])), [accounts]);
  const totalD = lines.reduce((s, l) => s + n(l.debit), 0);
  const totalC = lines.reduce((s, l) => s + n(l.credit), 0);
  const balanced = totalD === totalC && totalD > 0;
  const tpl = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
    setTemplate(id);
    setJournal(t.journal);
    setLines(t.lines.map(([account]) => ({ ...empty(), account })));
    setAmount("");
  };
  const applyAmount = (v: string) => {
    setAmount(v);
    if (!tpl.id || tpl.id === "REMB_EMPRUNT") return;
    setLines((ls) => ls.map((l, i) => ({ ...l, debit: tpl.lines[i]?.[1] === "D" ? v : "", credit: tpl.lines[i]?.[1] === "C" ? v : "" })));
  };
  const set = (i: number, k: keyof L, v: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v, ...(k === "debit" && v ? { credit: "" } : {}), ...(k === "credit" && v ? { debit: "" } : {}) } : l)));

  const payload = JSON.stringify(lines.map((l) => ({ account: l.account.trim(), label: l.label.trim() || undefined, aux: l.aux.trim() || undefined, debit: n(l.debit), credit: n(l.credit) })));

  return (
    <form action={saveManualEntryAction} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="lines" value={payload} />
      <input type="hidden" name="template" value={template} />
      <datalist id="acc-list">{accounts.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}</datalist>

      {!initial && (
        <div className="rounded-2xl border border-line bg-white p-4">
          <label className="text-sm font-semibold text-navy" htmlFor="tpl">Type d&apos;opération</label>
          <select id="tpl" value={template} onChange={(e) => applyTemplate(e.target.value)} className={`mt-1 ${f}`}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="mt-2 text-xs text-navy/75">{tpl.hint}</p>
          {tpl.id && tpl.id !== "REMB_EMPRUNT" && (
            <label className="mt-3 block text-sm text-navy">Montant (F)
              <input inputMode="numeric" value={amount} onChange={(e) => applyAmount(e.target.value)} className={`mt-1 ${f}`} placeholder="ex. 150 000" />
            </label>
          )}
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-4">
        <label className="text-sm text-navy">Date<input type="date" name="date" required defaultValue={initial?.date ?? today} className={`mt-1 ${f}`} /></label>
        <label className="text-sm text-navy">Journal
          <select name="journal" value={journal} onChange={(e) => setJournal(e.target.value)} className={`mt-1 ${f}`}>
            {["OD", "BQ", "AN", "AC", "VE", "RE", "ST"].map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </label>
        <label className="text-sm text-navy sm:col-span-2">Libellé<input name="label" required defaultValue={initial?.label ?? ""} placeholder={tpl.id ? tpl.label : "ex. Frais de dossier prêt"} className={`mt-1 ${f}`} /></label>
        <label className="text-sm text-navy sm:col-span-2">Référence de la pièce (facultatif)<input name="reference" defaultValue={initial?.reference ?? ""} placeholder="n° de reçu, de relevé…" className={`mt-1 ${f}`} /></label>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-navy">Lignes</p>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-cream/60 p-2.5 sm:grid-cols-[110px_1fr_120px_120px_auto] sm:items-start sm:bg-transparent sm:p-0">
              <div>
                <input list="acc-list" value={l.account} onChange={(e) => set(i, "account", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Compte" aria-label="Compte" className={`${f} font-mono`} />
                <p className="mt-0.5 text-[11px] leading-4 text-navy/70">{labels.get(l.account) ?? (l.account ? "compte personnalisé" : "")}</p>
              </div>
              <input value={l.aux} onChange={(e) => set(i, "aux", e.target.value)} placeholder="Tiers ou précision (facultatif)" aria-label="Tiers" className={f} />
              <input inputMode="numeric" value={l.debit} onChange={(e) => set(i, "debit", e.target.value)} placeholder="Débit" aria-label="Débit" className={`${f} text-right`} />
              <input inputMode="numeric" value={l.credit} onChange={(e) => set(i, "credit", e.target.value)} placeholder="Crédit" aria-label="Crédit" className={`${f} text-right`} />
              <button type="button" onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((_, j) => j !== i) : ls))} aria-label="Retirer la ligne" className="justify-self-end rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-30" disabled={lines.length <= 2}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines((ls) => [...ls, empty()])} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline"><Plus size={15} /> Ajouter une ligne</button>
        <div className={`mt-4 flex flex-wrap justify-between gap-2 rounded-xl px-3 py-2 text-sm ${balanced ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
          <span>Débit {totalD.toLocaleString("fr-FR")} F · Crédit {totalC.toLocaleString("fr-FR")} F</span>
          <strong>{balanced ? "Équilibrée ✓" : totalD || totalC ? `Écart ${(totalD - totalC).toLocaleString("fr-FR")} F` : "Saisissez les montants"}</strong>
        </div>
      </div>
      <Submit />
    </form>
  );
}
